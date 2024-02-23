import {splitPath} from "./js-util.js";

export default class QqlRestServer {
	constructor(qql) {
		this.qql=qql;
	}

	async handleRequest(req) {
        let argv=splitPath(new URL(req.url).pathname);
        let url=new URL(req.url);

        // Find Many.
        if (req.method=="GET" &&
        		argv.length==1 &&
        		this.qql.getTableByName(argv[0])) {
            let where={};
            if (url.searchParams.get("filter"))
                where=JSON.parse(url.searchParams.get("filter"));

        	return Response.json(await this.qql({
        		manyFrom: argv[0],
                where: where
        	}));
        }

        // Find One.
        if (req.method=="GET" &&
        		argv.length==2 &&
        		this.qql.getTableByName(argv[0])) {
        	let table=this.qql.getTableByName(argv[0]);
        	let pkField=table.getPrimaryKeyFieldName()
        	return Response.json(await this.qql({
        		oneFrom: argv[0],
        		where: {[pkField]: argv[1]}
        	}));
        }

        // Create.
        if (req.method=="POST" &&
                argv.length==1 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            let pkField=table.getPrimaryKeyFieldName()
            let pkValue=await this.qql({
                insertInto: argv[0],
                set: await req.json()
            });

            return Response.json(await this.qql({
                oneFrom: argv[0],
                where: {[pkField]: pkValue}
            }));
        }

        // Update.
        if (req.method=="PUT" &&
                argv.length==2 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            let pkField=table.getPrimaryKeyFieldName()
            this.qql({
                update: argv[0],
                where: {[pkField]: argv[1]},
                set: await req.json()
            })

            return Response.json(await this.qql({
                oneFrom: argv[0],
                where: {[pkField]: argv[1]}
            }));
        }

        if (req.method=="DELETE" &&
                argv.length==2 &&
                this.qql.getTableByName(argv[0])) {
            let table=this.qql.getTableByName(argv[0]);
            let pkField=table.getPrimaryKeyFieldName()
            let item=await this.qql({
                oneFrom: argv[0],
                where: {[pkField]: argv[1]}
            });

            await this.qql({
                deleteFrom: argv[0],
                where: {[pkField]: argv[1]}
            });

            return Response.json(item);
        }
	}
}