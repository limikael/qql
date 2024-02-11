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
}