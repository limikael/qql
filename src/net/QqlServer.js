import {splitPath, jsonEq} from "../utils/js-util.js";

export default class QqlServer {
	constructor(qql, options={}) {
		this.qql=qql;
		if (options.path)
			this.pathComponents=splitPath(options.path);

		else
			this.pathComponents=[];
	}

	async handleEnvRequest(env, req) {
		//await new Promise(r=>setTimeout(r,1000));
        let argv=splitPath(new URL(req.url).pathname);

        if (!jsonEq(argv,this.pathComponents))
        	return;

        let headers=new Headers();
        headers.set("Access-Control-Allow-Origin","*");

        let query=await req.json();
        try {
        	return Response.json(await env.query(query),{headers});
        }

        catch (e) {
        	return new Response(e.message,{status: 500, headers});
        }
	}

	async handleRequest(req) {
        return await this.handleEnvRequest(this.qql.rootEnv,req)
	}
}