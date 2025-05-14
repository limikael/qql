export class DeclaredError extends Error {
    constructor(...args) {
        super(...args);

        let options=args[1];
        if (options && options.status)
            this.status=options.status;

        this.declared=true;
    }
}

export function arrayChunkify(arr,len) {
  let chunks = [],
      i = 0,
      n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }

  return chunks;    
}

export function arrayUnique(a) {
	function onlyUnique(value, index, array) {
		return array.indexOf(value) === index;
	}

	return a.filter(onlyUnique);
}

export function arrayDifference(a, b) {
    return a.filter(item=>!b.includes(item));   
}

export function arrayIntersection(a, b) {
    return a.filter(value => b.includes(value));
}

export function objectifyArgs(params, fields) {
    function isPlainObject(value) {
        if (!value)
            return false;

        if (value.constructor===Object)
            return true;

        if (value.constructor.toString().includes("Object"))
            return true;

        return false;
    }

	//const isPlainObject = value => value?.constructor === Object;
    let conf={};

    for (let i=0; i<params.length; i++) {
        //console.log(params[i],isPlainObject(params[i]));
        if (isPlainObject(params[i]))
            conf={...conf,...params[i]}

        else if (fields[i])
            conf[fields[i]]=params[i];
    }

    return conf;
}

export function assertAllowedKeys(o, allowedKeys) {
    let disallowed=Object.keys(o).filter(v=>!allowedKeys.includes(v));
    if (disallowed.length)
        throw new Error("Unknown keys: "+disallowed.join(","));
}

export function arrayify(cand) {
    if (!cand)
        return [];

    if (!Array.isArray(cand))
        return [cand];

    return cand;
}

export function splitPath(pathname) {
    if (pathname===undefined)
        throw new Error("Undefined pathname");

    return pathname.split("/").filter(s=>s.length>0);
}

export function getFileExt(fn) {
    if (fn.lastIndexOf(".")<0)
        throw new Error("Filename doesn't contain a dot.");

    return fn.slice(fn.lastIndexOf("."));
}

export function jsonClone(v) {
    return JSON.parse(JSON.stringify(v));
}

export function jsonEq(a,b) {
    return (JSON.stringify(a)==JSON.stringify(b));
}

export class CallableClass extends Function {
    constructor(f) {
        return Object.setPrototypeOf(f, new.target.prototype);
    }
}
