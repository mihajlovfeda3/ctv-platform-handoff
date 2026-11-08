import {BusinessWorkspace} from "@/features/business/workspace";
export const dynamic="force-dynamic";
export const metadata={title:"Матрица покрытия ЦТ"};
export default function Page(props:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <BusinessWorkspace view="coverage" {...props}/>;}
