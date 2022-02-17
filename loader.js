import crypto from 'crypto';
import Knex from 'knex';

const assert = (statement, errorMsg) => {
    if (!statement) {
        throw new Error(errorMsg);
    }
}

// spec harness
class Loader {
    constructor(app, multihash) {
        this.models = [];
        this.routes = [];
        this.actions = [];
        this.onready = null;

        this.express = app;
        this.multihash = multihash;
        this.knex = Knex({
            client: 'better-sqlite3',
            connection: {
                filename: `./db/${multihash}.sqlite`,
                //filename: ':memory:',
            },
            //debug: true,
            useNullAsDefault: true,
        });
    }

    ready(callback) {
        assert(!this.onready, "attempted to override an existing onready handler");
        this.onready = callback;
    }

    get db() {
        const cached = {};
        for (const [tableName, fields] of this.models) {
            cached[tableName] = {
                create: async (args) => {
                    assert(tableName.match(/^[a-z0-9]+$/i), "table name must be alphanumeric");
                    const returning = await this.knex(tableName).insert(args).returning('id');
                    const { id } = returning[0];
                    return id;
                }
            };
        }
        return cached;
    }

    model(table, fields) {
        // check column types
        assert(table.match(/^[a-z0-9]+$/i), "table name must be alphanumeric");
        for (const [column, columnType] of Object.entries(fields)) {
            assert(column.match(/^[a-z0-9]+$/i), "column name must be alphanumeric");
            assert(isValidColumnType(columnType), "column type must be valid");
        }

        this.models.push([table, Object.entries(fields)]);
    }

    route(path, query) {
        // TODO: check for valid path
        // TODO: check for valid query

        this.routes.push([path, query]);
    }

    action(callsig, fn) {
        // check call signature
        const [, name, arglist] = callsig.match(/^([a-z0-9]+)\(((?:[a-z0-9]+\,? ?)+)\)$/i);
        const args = arglist.split(',').map(a => a.trim());

        assert(name.match(/^[a-z0-9]+$/i), "action name must be alphanumeric");
        for (const arg of args) {
            assert(arg.match(/^[a-z0-9]+$/i), "arguments must be alphanumeric");
        }

        this.actions.push([name, args, fn]);
    }

    async syncDB() {
        // check against the current database schema
        const matchesNoTables = this.models.every(([tableName, fields]) =>
            !this.knex.schema.hasTable(tableName)
        );
        const matchesAllTables = this.models.every(([tableName, fields]) =>
            this.knex.schema.hasTable(tableName)
            // TODO: check for an exact schema match
        );

        // create tables if starting with a fresh db
        if (!matchesNoTables && !matchesAllTables) {
            throw new Error('Database schema out of sync');
        } else if (matchesNoTables) {
            for (const [tableName, fields] of this.models) {
                await this.knex.schema.createTable(tableName, (table) => {
                    fields.map(([fieldName, fieldType]) => {
                        switch (fieldType) {
                            case 'primary':
                                return table.string(fieldName).primary().notNullable();
                            case 'text':
                                return table.text(fieldName);
                            case 'string':
                                return table.string(fieldName);
                            case 'datetime':
                                return table.datetime(fieldName);
                            case 'boolean':
                                return table.boolean(fieldName);
                            default:
                                const fk = fieldType.split('.');
                                assert(fk.length === 2, "column must be a valid primary type or foreign key");
                                assert (fk[0].match(/^[a-z0-9]+$/), "foreign key table must be alphanumeric");
                                assert (fk[1].match(/^[a-z0-9]+$/), "foreign key field must be alphanumeric");
                                return table.string(fieldName).references(fk[1]).inTable(fk[0]).notNullable();
                        }
                    });
                });
            }
        }

        return this;
    }

    async writeAction(name, ...args) {
        const [, argnames, fn] = this.actions.find((a) => a[0] === name);

        // generate metadata for action handlers
        const meta = {
            chainId: null,
            blockhash: null,
            timestamp: null, // TODO(v1): also retrieve the blockhash, chain id, and derive a timestamp
            origin: "00000000000000000000000000000000", // TODO(v1): use origin address
            id: crypto.randomBytes(16).toString("hex"), // TODO(v1): derive from hash(calldata, blockhash)
        };
        const id = await fn.apply(meta, args);
        return id;
    }

    server() {
        for (const [route, query] of this.routes) {
            assert(route.startsWith('/'), 'Spec routes must start with trailing slash');
            const filterParams = route.match(/:[a-z0-9]+/ig);
            this.express.get(`/apps/${this.multihash}${route}`, async (req, res) => {
                // filter parameters before executing query
                const params = Object.fromEntries(
                    Object.keys(req.params)
                        .filter((p) => filterParams.includes(`:${p}`))
                        .map((p) => [p, req.params[p]]));

                // execute query
                const result = await this.knex.raw(query, params);
                res.json(result);
            });
        }

        this.express.post(`/apps/${this.multihash}/:action`, async(req, res) => {
            const action = this.actions.find(([fnName, argNames]) => {
                return fnName === req.params.action;
            });
            if (!action) {
                return res.status(400).json({ error: 'Invalid action' });
            }

            const [fnName, argNames] = action;
            let args = []
            for (const argName of argNames) {
                if (req.body[argName] === undefined) {
                    console.log(fnName, 'missing parameter:', argName);
                    return res.status(400).json({ error: 'Missing parameter: ' + argName });
                }
                args.push(req.body[argName]);
            }

            console.log(fnName, argNames, args);
            const id = await this.writeAction(fnName, ...args);
            res.json({ status: "ok", id });
        });

        return this.express;
    }
}

const isValidColumnType = (c) => {
    switch (c) {
        case 'primary': return true;
        case 'string': return true;
        case 'text': return true;
        case 'datetime': return true;
        case 'boolean': return true;
        default:
            const fk = c.split('.');
            assert(fk.length === 2, "column must be a valid primary type or foreign key");
            assert (fk[0].match(/^[a-z0-9]+$/), "foreign key table must be alphanumeric");
            assert (fk[1].match(/^[a-z0-9]+$/), "foreign key field must be alphanumeric");
            return true;
    }
}

export { Loader };
