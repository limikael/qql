export default class QqlEnv {
	constructor({qql, root, env}) {
		this.root=root;
		this.qql=qql;

		if (!env)
			env={};

		this.env=env;
	}

	query=async query=>{
		return this.qql.envQuery(this,query);
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