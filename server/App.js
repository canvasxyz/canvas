import React, { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

const App = () => {
    const fetcher = (url) => fetch(url).then((res) => res.json());
    const { data: info } = useSWR(`/info`, fetcher);
    const [spec, setSpec] = useState();
    const { data: actionsData } = useSWR(() => spec && `/actions/${spec}`, fetcher);

    return (
        <div onClick={() => setSpec(undefined)}>
          <div className="container max-w-4xl m-auto">
            <div className="mt-6 mb-6">
              Application Hub
            </div>
            {info &&
             <div className={`p-4 px-5 mb-2 bg-white border rounded-lg shadow-sm cursor-pointer ${spec === info.multihash && 'border-blue-400'}`}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSpec(info.multihash); }}>
               <div className="font-bold text-lg mb-1 leading-snug">raymondz.eth/canvas-polls</div>
               <div className="text-gray-400 text-sm mb-1">{info.multihash}</div>
               <div className="text-sm">{info.specSize} bytes</div>
             </div>}
            {actionsData &&
             <div onClick={(e) => e.stopPropagation()}>
               <table className="w-full border-collapse">
                   <thead>
                     <tr className="text-left">
                       <th className="p-1 px-2 text-sm">Action</th>
                       <th className="p-1 px-2 text-sm">Address</th>
                       <th className="p-1 px-2 text-sm">Call</th>
                     </tr>
                   </thead>
                 <tbody>
                   {actionsData.actions?.map((action) => {
                       const args = JSON.stringify(action.args);
                       return <tr key={action.meta.id} className="text-left">
                                <td className="p-1 px-2 border border-slate-200">{action.meta.id}</td>
                                <td className="p-1 px-2 border border-slate-200">{action.meta.origin.slice(0, 7)}...</td>
                                <td className="p-1 px-2 border border-slate-200">{action.meta.call}({args.slice(1, args.length - 1)})</td>
                              </tr>;
                   })}
                 </tbody>
               </table>
             </div>}
          </div>
        </div>
    );
};

export default App;
