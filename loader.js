import axios from 'axios';
import express from 'express';
import crypto from 'crypto';
import Knex from 'knex';
import spec from './test.prologue.js';

const knex = Knex({
    client: 'better-sqlite3',
    connection: {
        //filename: './prologue.sqlite',
        filename: ':memory:',
    },
    //debug: true,
    useNullAsDefault: true,
});

class Prologue {
    constructor(spec) {
        this.models = [];
        this.routes = [];
        this.actions = [];
        this.onready = null;

        spec.call(null, this);

        this.initializeModels().then(() => {
            this.initialized = true;
            if (this.onready) {
                this.onready.call(this);
            }
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
                    const returning = await knex(tableName).insert(args).returning('id');
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

    async initializeModels() {
        for (const [tableName, fields] of this.models) {
            await knex.schema.createTable(tableName, (table) => {
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
        const server = express();

        for (const [route, query] of this.routes) {
            const acceptableParams = route.match(/:[a-z0-9]+/ig);
            server.get(route, async (req, res) => {
                // filter parameters before executing query
                const params = Object.fromEntries(
                    Object.keys(req.params)
                        .filter((p) => acceptableParams.includes(`:${p}`))
                        .map((p) => [p, req.params[p]]));

                // execute query
                const result = await knex.raw(query, params);
                res.json(result);
            });
        }

        return server;
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

const assert = (statement, errorMsg) => {
    if (!statement) {
        throw new Error(errorMsg);
    }
}

const prologue = new Prologue(spec);

prologue.ready(async () => {
    const pollId = await prologue.writeAction('createPoll', 'Should Verses adopt a motto?');
    const cardId1 = await prologue.writeAction('createCard', pollId, 'Yes, we should vote on one now');
    const cardId2 = await prologue.writeAction('createCard', pollId, 'Yes, with modifications to the question');
    const cardId3 = await prologue.writeAction('createCard', pollId, 'No, we should leave it open ended');
    await prologue.writeAction('createVote', cardId1, false);
    await prologue.writeAction('createVote', cardId1, true);

    prologue.server().listen(3000, () => {
        console.log('Server listening on port 3000');
        axios.get('http://localhost:3000/polls').then((({ data }) => console.log(data)));
        axios.get(`http://localhost:3000/polls/${pollId}`).then((({ data }) => console.log(data)));
    });
});
