class CallableClass extends Function {
	constructor(f) {
		return Object.setPrototypeOf(f, new.target.prototype);
	}
}

class MyClass extends CallableClass {
	constructor() {
		super(v=>this.somefunc(v));
		this.test=123;
		console.log("here");
	}

	somefunc(v) {
		return this.test+v;
	}
}

console.log("constructing");

let f=new MyClass();

console.log("test is: "+f.test);

console.log("calling");

console.log("f ret: "+f(10));