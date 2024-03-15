import {splitPath, jsonEq} from "./js-util.js";

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

        let query=await req.json();
        try {
        	return Response.json(await env.query(query));
        }

        catch (e) {
        	return new Response(e.message,{status: 500});
        }
	}

	async handleRequest(req) {
        return await this.handleEnvRequest(this.qql.rootEnv,req)
	}
}