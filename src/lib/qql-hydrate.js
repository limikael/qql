import {isClass} from "../utils/js-util.js";
const pkFieldName="id";

function appendFunction(target, name, fn) {
	Object.defineProperty(target,name,{
		enumeratable: false,
		value: fn
	});
}

function hydrateSingleObject({qql, data, parentArray, parentObject, oneFrom, where, include, wrapper, via, fieldNames}) {
	async function insert() {
		function pushToParent() {
			data.__tmp_id=crypto.randomUUID();
			let parentIndex=parentArray.findIndex(d=>d.__tmp_id==data.__tmp_id);
			if (parentIndex<0)
				parentArray.push(data);

			delete data.__tmp_id;
		}

		//fieldNames=getDataFieldNames();
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
			//console.log(includeQuery);
			data[includeField]=qqlHydrateMany({
				qql,
				wrapper,
				data: data[includeField],
				parentObject: data,
				...includeQuery
			});
		}

		else if (includeQuery.oneFrom) {
			if (data[includeField]) {
				qqlHydrateOne({
					qql,
					wrapper,
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

function qqlHydrateOne({qql, data, parentArray, parentObject, oneFrom, where, include, wrapper, via, hydrate}) {
	if (!hydrate)
		return data;

	if (!include)
		include={};

	let fieldNames=[];
	for (let fid in data) {
		if (fid!=pkFieldName && !Object.keys(include).includes(fid))
			fieldNames.push(fid)
	}

	if (isClass(hydrate))
		data=new hydrate(data, {qql});

	else
		data=hydrate(data, {qql});

	if (wrapper)
		data=wrapper(data);

	hydrateSingleObject({qql, data, parentArray, parentObject, oneFrom, where, include, wrapper, via, fieldNames});

	return data;
}

function qqlHydrateMany({qql, data, manyFrom, where, include, via, wrapper, parentObject, hydrate}) {
	if (!hydrate)
		return data;

	let dataArray=[];
	if (wrapper)
		dataArray=wrapper(dataArray);

	for (let item of data) {
		dataArray.push(qqlHydrateOne({
			qql,
			data: item, 
			oneFrom: manyFrom,
			where, 
			include,
			wrapper,
			parentArray: dataArray,
			parentObject: parentObject,
			via,
			hydrate
		}));
	}

	function newItem(newObject) {
		if (!newObject)
			throw new Error("Need object for new");

		if (parentObject && !via)
			throw new Error("Need via to create object on parent");

		//let newObject=objectFactory();
		if (where) {
			for (let k in where)
				newObject[k]=where[k];
		}

		for (let k in include)
			newObject[k]=[];

		return qqlHydrateOne({
			qql,
			data: newObject,
			parentArray: dataArray,
			parentObject: parentObject,
			oneFrom: manyFrom,
			where,
			include,
			wrapper,
			hydrate,
			via
		});

		//return newObject;
	}

	appendFunction(dataArray,"new",newItem);

	async function saveNewChildren() {
		for (let item of dataArray)
			await item.saveIfNew();
	}

	appendFunction(dataArray,"saveNewChildren",saveNewChildren);

	return dataArray;
}

export function qqlHydrateData(args) {
	//console.log(args);

	if (args.oneFrom)
		return qqlHydrateOne(args)

	else if (args.manyFrom)
		return qqlHydrateMany(args)

	else
		throw new Error("unknown query for hydration");
}

export function qqlHydrate(args) {
	return qqlHydrateData(args);
}

export function qqlRemoveHydrate(query) {
	let resultQuery={};
	Object.assign(resultQuery,query);
	delete resultQuery.hydrate;
	delete resultQuery.wrapper;

	if (resultQuery.include) {
		let originalInclude=resultQuery.include;
		resultQuery.include={};

		for (let k in originalInclude)
			resultQuery.include[k]=qqlRemoveHydrate(originalInclude[k]);
	}

	return resultQuery;
}

export function qqlIsHydrate(query) {
	if (query.hydrate)
		return true;

	if (query.include)
		for (let k in query.include)
			if (qqlIsHydrate(query.include[k]))
				return true;
}

export async function qqlHydrateQuery({qql, ...query}) {
	//console.log(query);
	let data=await qql(qqlRemoveHydrate(query));
	//console.log(query);

	return qqlHydrateData({...query, qql, data});
}

/*export function hydratingQql(qql) {
	return async query=>{
		let res=await qql({...query});
		res=qqlHydrate(qql,query,res);
		return res;
	}
}*/
