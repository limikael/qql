export default class Reference {
	constructor({oneFrom, oneProp, manyFrom, manyProp, manyField}) {
		this.oneFrom=oneFrom;
		this.oneProp=oneProp;
		this.manyFrom=manyFrom;
		this.manyProp=manyProp;
		this.manyField=manyField;

		if (!this.oneProp)
			this.oneProp=this.manyFrom.name;
	}
}