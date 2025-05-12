import {CallableClass} from "../utils/js-util.js";

export default class QqlEnv extends CallableClass {
	constructor({qql, root, env}) {
		super(q=>this.query(q));

		this.root=root;
		this.qql=qql;

		if (!env)
			env={};

		this.env=env;
	}

	query=async query=>{
		return this.qql.envQuery(this,query);
	}

	isChecked() {
		return !this.root;
	}

	isRoot() {
		return this.root;
	}

	getRole() {
		return this.env.role;
	}

	substituteVars(s) {
		if (typeof s!="string")
			return s;

		if (s.charAt(0)!="$")
			return s;

		s=s.slice(1);
		if (!this.env.hasOwnProperty(s))
			throw new Error("Env variable not set: "+s);

		return this.env[s];
	}
}