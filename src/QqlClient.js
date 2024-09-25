import {objectifyArgs} from "./js-util.js";

export default class QqlClient {
	constructor({fetch, url, headers}) {
		//console.log("QqlClient ctor:",url,fetch);

		if (!fetch)
			fetch=globalThis.fetch.bind(globalThis);

		this.url=url;
		this.fetch=fetch;
		this.headers=headers;
	}

	query=async(query)=>{
		//console.log("query ",this.url,"query",query);
		//console.log(JSON.stringify(query));

		let response=await this.fetch(this.url,{
			method: "POST",
			body: JSON.stringify(query),
			headers: this.headers
		});

		//console.log("respone...",response);

		if (response.status<200 || response.status>=300)
			throw new Error(await response.text());

		return await response.json();
	}
}

export function createQqlClient(...args) {
	//console.log("createQqlClient:",args);//, fetch=",fetch," url="+url);

	let options=objectifyArgs(args,["url"])
	//console.log("options",options);
	let qqlClient=new QqlClient(options);

	return (query=>qqlClient.query(query));
}