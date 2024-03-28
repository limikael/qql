import {objectifyArgs} from "./js-util.js";

export default class QqlClient {
	constructor({fetch, url, headers}) {
		if (!fetch)
			fetch=globalThis.fetch;

		this.url=url;
		this.fetch=fetch;
		this.headers=headers;
	}

	query=async(query)=>{
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
	let options=objectifyArgs(args,["url"])
	let qqlClient=new QqlClient(options);

	return (query=>qqlClient.query(query));
}