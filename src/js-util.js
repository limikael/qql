export function arrayOnlyUnique(a) {
	function onlyUnique(value, index, array) {
		return array.indexOf(value) === index;
	}

	return a.filter(onlyUnique);
}

export function objectifyArgs(params, fields) {
	const isPlainObject = value => value?.constructor === Object;
    let conf={};

    for (let i=0; i<params.length; i++) {
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
