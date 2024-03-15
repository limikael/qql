import {useRef, createContext, useContext} from "react";
import QqlClient from "./QqlClient.js";

let QqlContext=createContext();

export function QqlProvider({fetch, url, children}) {
	let ref=useRef();
	if (!ref.current)
		ref.current=new QqlClient({fetch,url});

	return (
		<QqlContext.Provider value={ref.current}>
			{children}
		</QqlContext.Provider>
	);
}

export function useQql() {
	let qqlClient=useContext(QqlContext);
	return qqlClient.query;
}