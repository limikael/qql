export function sqliteDriver(db) {
	function singleQuery(query) {
		return new Promise((resolve,reject)=>{
			db.all(query,(err,rows)=>{
				//console.log(rows);

				if (err)
					reject(err);

				else
					resolve(rows);
			});
		})
	}

	return async queries=>{
		let res=[];

		for (let query of queries)
			res.push(await singleQuery(query))

		return res;
	}
}