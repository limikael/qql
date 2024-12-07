import {useRef, createContext, useContext} from "react";
import {createQqlClient} from "../net/QqlClient.js";

let QqlContext=createContext();

export function QqlProvider({fetch, url, children, qql}) {
	let ref=useRef();
	if (!ref.current) {
		if (qql)
			ref.current=qql;

		else
			ref.current=createQqlClient({fetch,url});
	}

	return (
		<QqlContext.Provider value={ref.current}>
			{children}
		</QqlContext.Provider>
	);
}

export function useQql() {
	return useContext(QqlContext);
}