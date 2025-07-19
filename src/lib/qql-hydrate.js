function appendFunction(target, name, fn) {
	Object.defineProperty(target,name,{
		enumeratable: false,
		value: fn
	});
}

function qqlHydrateOne({qql, data, parentArray, parentObject, oneFrom, where, include, objectFactory, via}) {
	let pkFieldName="id";
	if (!include)
		include={};

	function getDataFieldNames() {
		let fns=[];
		for (let fid in data) {
			if (fid!=pkFieldName && !Object.keys(include).includes(fid))
				fns.push(fid)
		}

		return fns;
	}

	let fieldNames=getDataFieldNames();

	async function insert() {
		function pushToParent() {
			data.__tmp_id=crypto.randomUUID();
			let parentIndex=parentArray.findIndex(d=>d.__tmp_id==data.__tmp_id);
			if (parentIndex<0)
				parentArray.push(data);

			delete data.__tmp_id;
		}

		fieldNames=getDataFieldNames();
		let set=Object.fromEntries(fieldNames.map(f=>[f,data[f]]));

		if (via) {
			let parentPk=parentObject[pkFieldName];
			if (!parentPk) {
				pushToParent();
				return;
			}
			set[via]=parentPk;
			data[via]=parentPk;
		}

		let insertedId=await qql({
			insertInto: oneFrom, 
			set: set,
		});

		data[pkFieldName]=insertedId;

		for (let includeField in include)
			await data[includeField].saveNewChildren();

		pushToParent();
	}

	async function save() {
		if (data[pkFieldName]) {
			let set=Object.fromEntries(fieldNames.map(f=>[f,data[f]]));
			await qql({
				update: oneFrom, 
				set: set,
				where: {[pkFieldName]: data[pkFieldName]}
			});
		}

		else {
			await insert();
		}
	}

	appendFunction(data,"save",save);

	async function saveIfNew() {
		if (!data[pkFieldName])
			await insert();
	}

	appendFunction(data,"saveIfNew",saveIfNew);

	async function deleteItem() {
		if (data[pkFieldName]) {
			await qql({
				deleteFrom: oneFrom, 
				where: {[pkFieldName]: data[pkFieldName]}
			});
		}

		//console.log(parentArray);

		if (parentArray) {
			data.__tmp_id=crypto.randomUUID();
			let parentIndex=parentArray.findIndex(d=>d.__tmp_id==data.__tmp_id);
			//console.log("parent index: "+parentIndex);
			if (parentIndex>=0)
				parentArray.splice(parentIndex,1);
		}
	}

	appendFunction(data,"delete",deleteItem);

	for (let includeField in include) {
		let includeQuery=include[includeField];

		if (includeQuery.manyFrom) {
			qqlHydrateMany({
				qql,
				objectFactory,
				data: data[includeField],
				parentObject: data,
				...includeQuery
			});
		}

		else if (includeQuery.oneFrom) {
			if (data[includeField]) {
				qqlHydrateOne({
					qql,
					objectFactory,
					data: data[includeField],
					...includeQuery
				});
			}
		}

		else {
			throw new Error("Strange include query");
		}
	}
}

function qqlHydrateMany({qql, data, manyFrom, where, include, via, objectFactory, parentObject}) {
	if (!objectFactory)
		objectFactory=()=>new Object();

	//console.log("many",data,"from",manyFrom);

	for (let item of data) {
		qqlHydrateOne({
			qql,
			data: item, 
			oneFrom: manyFrom,
			where, 
			include,
			objectFactory,
			parentArray: data,
			parentObject: parentObject,
			via
		});
	}

	function newItem() {
		if (parentObject && !via)
			throw new Error("Need via to create object on parent");

		let newObject=objectFactory();
		if (where) {
			for (let k in where)
				newObject[k]=where[k];
		}

		for (let k in include)
			newObject[k]=[];

		qqlHydrateOne({
			qql,
			data: newObject,
			parentArray: data,
			parentObject: parentObject,
			oneFrom: manyFrom,
			where,
			include,
			objectFactory,
			via
		});

		return newObject;
	}

	appendFunction(data,"new",newItem);

	async function saveNewChildren() {
		for (let item of data)
			await item.saveIfNew();
	}

	appendFunction(data,"saveNewChildren",saveNewChildren);

}

export function qqlHydrateData(args) {
	//console.log(args);

	if (args.oneFrom)
		qqlHydrateOne(args)

	else if (args.manyFrom)
		qqlHydrateMany(args)

	else
		throw new Error("unknown query for hydration");

}

export async function qqlHydrateQuery({qql, ...query}) {
	let data=await qql(structuredClone(query));
	qqlHydrateData({...query, qql, data});

	return data;
}

/*export function hydratingQql(qql) {
	return async query=>{
		let res=await qql({...query});
		res=qqlHydrate(qql,query,res);
		return res;
	}
}*/
