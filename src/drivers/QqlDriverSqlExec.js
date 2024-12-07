import QqlDriverBase from "./QqlDriverBase.js";

export default class QqlDriverSqlExec extends QqlDriverBase {
	constructor(sqlExec) {
		super({escapeFlavor: "sqlite"});

		this.sqlExec=sqlExec;
	}

	query=async (query, params, returnType)=>{
		if (params.length)
			throw new Error("Params not supported by sql exec driver");

		let res=await this.queries([query],"rows");
		if (returnType=="rows")
			return res[0];
	}

	queries=async (queries, returnType)=>{
		if (!["rows","none"].includes(returnType))
			throw new Error("unsupported return type: "+returnType);

		let res=await this.sqlExec(queries.join("; "));
		if (returnType=="rows")
			return res;
	}
}
