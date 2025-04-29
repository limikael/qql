export default class IdGenerator {
	constructor() {
		this.id=1;
	}

	pick() {
		let current=this.id;
		this.id++;

		return current;
	}
}