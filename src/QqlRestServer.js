import {splitPath, getFileExt} from "./js-util.js";

export default class QqlRestServer {
	constructor(qql, options={}) {
		this.qql=qql;

        this.path=options.path;
        this.putFile=options.putFile;
	}

    async decodeRequestData(req) {
        let exts=[".jpg",".jpeg",".png",".webp"];
        let contentType=req.headers.get("content-type").split(";")[0];

        switch (contentType) {
            case "multipart/form-data":
                let formData=await req.formData();
                let record={};
                for (let [name,data] of formData.entries()) {
                    if (data instanceof File) {
                        //console.log("putting: "+data.name+" size: "+data.size);

                        let ext=getFileExt(data.name).toLowerCase();
                        if (!exts.includes(ext))
                            throw new Error("Unknown file type: "+ext);

                        let fn=crypto.randomUUID()+ext;
                        await this.putFile(fn,data);
                        record[name]=fn;
                    }

                    else {
                        record[name]=JSON.parse(data);
                    }
                }

                return record;
                break;

            case "application/json":
                return await req.json();
                break;
        }

        throw new Error("Unexpected content type: "+contentType);

    }

    async handleEnvRequest(env, req) {
        let argv=splitPath(new URL(req.url).pathname);
        let url=new URL(req.url);

        if (this.path) {
            let splitApiPath=splitPath(this.path);
            while (splitApiPath.length) {
                if (argv[0]!=splitApiPath[0])
                    return;

                argv.shift();
                splitApiPath.shift();
            }
        }

        // Find Many.
        if (req.method=="GET" &&
                argv.length==1 &&
                this.qql.getTableByName(argv[0])) {
            let where={};
            if (url.searchParams.get("filter"))
                where=JSON.parse(url.searchParams.get("filter"));

            let table=this.qql.getTableByName(argv[0]);
            if (where.q && table.recordRepresentation) {
                where[table.recordRepresentation+"~"]=where.q;
                delete where.q;
            }

            let count=await env.query({
                countFrom: argv[0],
                where: where
            });

            let range=[0,count-1];
            if (url.searchParams.get("range"))
                range=JSON.parse(url.searchParams.get("range"));

            let sort;
            if (url.searchParams.get("sort"))
                sort=JSON.parse(url.searchParams.get("sort"));

            let query={
                manyFrom: argv[0],
                where: where,
                offset: range[0],
                limit: range[1]-range[0]+1,
                sort: sort
            };

            let response=Response.json(await env.query(query));
            response.headers.set("content-range",`${range[0]}-${range[1]}/${count}`);

            return response;
        }

        // Find One.
        if (req.method=="GET" &&
                argv.length==2 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            let pkField=table.getPrimaryKeyFieldName();
            let item;

            if (table.singleton) {
                //console.log("singleton");
                item=await env.query({
                    oneFrom: argv[0]
                });
                item[table.getTable().getPrimaryKeyFieldName()]=argv[1];
            }

            else {
                item=await env.query({
                    oneFrom: argv[0],
                    where: {[pkField]: argv[1]}
                });
            }

            //console.log(item);
            if (!item)
                return new Response("Not found",{status: 404});

            return Response.json(item);
        }

        // Create.
        if (req.method=="POST" &&
                argv.length==1 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            return Response.json(await env.query({
                insertInto: argv[0],
                set: await this.decodeRequestData(req),
                return: "item"
            }));
        }

        // Update.
        if (req.method=="PUT" &&
                argv.length==2 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            let pkField=table.getPrimaryKeyFieldName()
            if (table.singleton) {
                let set=await this.decodeRequestData(req);
                delete set[table.getTable().getPrimaryKeyFieldName()];

                await env.query({
                    update: argv[0],
                    set: set
                });

                let singleItem=await env.query({
                    oneFrom: argv[0],
                });

                singleItem[table.getTable().getPrimaryKeyFieldName()]="single";
                return Response.json(singleItem);
            }

            else {
                return Response.json(await env.query({
                    update: argv[0],
                    where: {[pkField]: argv[1]},
                    set: await this.decodeRequestData(req),
                    return: "item"
                }));
            }
        }

        // Delete.
        if (req.method=="DELETE" &&
                argv.length==2 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            let pkField=table.getPrimaryKeyFieldName();
            return Response.json(await env.query({
                deleteFrom: argv[0],
                where: {[pkField]: argv[1]},
                return: "item"
            }));
        }
    }

	async handleRequest(req) {
        return await this.handleEnvRequest(this.qql.rootEnv,req)
	}
}