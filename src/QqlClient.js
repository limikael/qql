export default class QqlClient {
	constructor({fetch, url}) {
		if (!fetch)
			fetch=globalThis.fetch;

		this.url=url;
		this.fetch=fetch;
	}

	query=async(query)=>{
		let response=await this.fetch(this.url,{
			method: "POST",
			body: JSON.stringify(query)
		});

		//console.log("respone...",response);

		if (response.status<200 || response.status>=300)
			throw new Error(await response.text());

		return await response.json();
	}
}

export function createQqlClient({fetch, url}) {
	let qqlClient=new QqlClient({fetch,url});

	return (query=>qqlClient.query(query));
}