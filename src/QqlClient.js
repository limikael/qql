import {objectifyArgs, CallableClass} from "./js-util.js";

export default class QqlClient extends CallableClass {
	constructor(...args) {
		super(q=>this.query(q));

		let options=objectifyArgs(args,["url"])
		this.url=options.url;
		this.fetch=options.fetch;
		this.headers=options.headers;

		if (!this.fetch)
			this.fetch=globalThis.fetch.bind(globalThis);
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
	return new QqlClient(...args);
}