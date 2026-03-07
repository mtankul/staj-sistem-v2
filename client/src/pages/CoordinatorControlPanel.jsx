//:\staj-sistem-v2\client\src\pages\CoordinatorControlPanel.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Input,
  Space,
  Table,
  Tag,
  Drawer,
  Typography,
  Divider,
  Empty,
  Alert,
  Spin
} from "antd";
import api from "../api";

const { Text, Title } = Typography;

const WEEK_COUNT = 17;

const WEEK_OPTIONS = [{ value: "ALL", label: "Tüm Haftalar" }].concat(
  Array.from({ length: WEEK_COUNT }, (_, i) => ({
    value: i + 1,
    label: `Hafta ${i + 1}`,
  }))
);

const STATUS_META = {
  DRAFT: { color: "default", label: "Taslak" },
  SUBMITTED: { color: "blue", label: "Gönderildi" },
  RESUBMITTED: { color: "cyan", label: "Yeniden Gönderildi" },
  REVISION_REQUESTED: { color: "orange", label: "Düzeltme" },
  APPROVED: { color: "green", label: "Onaylandı" },
};

function statusTag(status) {
  const meta = STATUS_META[status] || { color: "default", label: status || "-" };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function cellStyle(item) {
  if (item?.isExam) return { background: "#fffbe6", border: "1px solid #ffe58f" };
  if (item?.reportStatus === "APPROVED") return { background: "#f6ffed", border: "1px solid #b7eb8f" };
  if (item?.reportStatus === "REVISION_REQUESTED") return { background: "#fff7e6", border: "1px solid #ffd591" };
  if (item?.reportStatus === "SUBMITTED" || item?.reportStatus === "RESUBMITTED") {
    return { background: "#e6f4ff", border: "1px solid #91caff" };
  }
  if (item?.practiceAbsent === true) return { background: "#fff1f0", border: "1px solid #ffa39e" };
  return { background: "#fafafa", border: "1px solid #f0f0f0" };
}

function tinyBadge(label, value, color = "#555") {
  return (
    <div style={{ fontSize: 11, color, lineHeight: 1.2 }}>
      <b>{label}:</b> {value}
    </div>
  );
}

function buildWeekCell(weekItem) {

  if (!weekItem) {
    return (
      <div style={{
        borderRadius:8,
        padding:6,
        minHeight:72,
        fontSize:12,
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        color:"#999",
        background:"#fafafa",
        border:"1px solid #f0f0f0"
      }}>
        -
      </div>
    );
  }

  if (weekItem.isExam) {
    return (
      <div style={{...cellStyle(weekItem),borderRadius:8,padding:6,minHeight:72,fontSize:11}}>
        <div style={{fontWeight:700,color:"#ad6800"}}>Sınav</div>
        <div>{weekItem.examLabel || "-"}</div>
        <div>Rapor Yok</div>
      </div>
    );
  }

  return (
    <div style={{...cellStyle(weekItem),borderRadius:8,padding:6,minHeight:72,fontSize:11,lineHeight:1.25}}>
      {tinyBadge("TY", weekItem.theoryPresent ? "Geldi" : weekItem.theoryAbsent ? "Yok" : "-")}
      {tinyBadge("UY", weekItem.practicePresent ? "Geldi" : weekItem.practiceAbsent ? "Yok" : "-")}
      {tinyBadge("R", weekItem.reportStatus || "-")}
      {tinyBadge("P", weekItem.reportScore ?? "-")}
    </div>
  );
}

export default function CoordinatorControlPanel(){

const [periods,setPeriods]=useState([])
const [periodId,setPeriodId]=useState(null)

const [search,setSearch]=useState("")

const [loading,setLoading]=useState(false)
const [rows,setRows]=useState([])
const [stats,setStats]=useState(null)
const [periodMeta,setPeriodMeta]=useState(null)

const [drawerOpen,setDrawerOpen]=useState(false)
const [activeRow,setActiveRow]=useState(null)

const [reportDetailOpen,setReportDetailOpen]=useState(false)
const [reportDetailLoading,setReportDetailLoading]=useState(false)
const [reportDetail,setReportDetail]=useState(null)
const [reportDetailMeta,setReportDetailMeta]=useState(null)

async function loadPeriods(){
const {data}=await api.get("/periods")
setPeriods(data||[])
if(data?.length){
setPeriodId(data[0].id)
}
}

async function loadPanel(){
if(!periodId) return

setLoading(true)

try{
const {data}=await api.get(`/teacher/coordinator-control?periodId=${periodId}`)
setRows(data?.items||[])
setStats(data?.stats||null)
setPeriodMeta(data?.period||null)
}catch{
setRows([])
}

setLoading(false)
}

async function openReportDetail(row,weekItem){

if(!row || !weekItem) return

setReportDetailLoading(true)
setReportDetailOpen(true)

setReportDetailMeta({
studentId:row.studentId,
studentNo:row.studentNo,
nameSurname:row.nameSurname,
weekNo:weekItem.weekNo
})

try{

const {data}=await api.get(
`/teacher/report-scores/detail?periodId=${periodId}&studentId=${row.studentId}&weekNo=${weekItem.weekNo}`
)

setReportDetail(data)

}catch{
setReportDetail(null)
}

setReportDetailLoading(false)

}

useEffect(()=>{loadPeriods()},[])
useEffect(()=>{loadPanel()},[periodId])

const filteredRows=useMemo(()=>{
let list=[...rows]

if(search){
const q=search.toLowerCase()
list=list.filter(r=>
r.nameSurname?.toLowerCase().includes(q) ||
r.studentNo?.toLowerCase().includes(q)
)
}

return list
},[rows,search])

const columns=[

{
title:"Öğrenci",
width:160,
fixed:"left",
render:(_,r)=>(
<div>
<div style={{fontWeight:700}}>{r.nameSurname}</div>
<div style={{fontSize:12,color:"#666"}}>{r.studentNo}</div>
</div>
)
},

{
title:"Rot-1",
width:150,
render:(_,r)=>(
<>
<div>{r.rot1HospitalName}</div>
<div style={{fontSize:12,color:"#666"}}>{r.rot1UnitName}</div>
</>
)
},

{
title:"Rot-2",
width:150,
render:(_,r)=>(
<>
<div>{r.rot2HospitalName}</div>
<div style={{fontSize:12,color:"#666"}}>{r.rot2UnitName}</div>
</>
)
},

...Array.from({length:WEEK_COUNT},(_,i)=>{

const week=i+1

return{

title:`H${week}`,
width:82,

render:(_,row)=>{

const item=(row.weeks||[]).find(x=>x.weekNo===week)

return(

<div
onClick={(e)=>{
e.stopPropagation()
openReportDetail(row,item)
}}
style={{cursor:"pointer"}}
>

{buildWeekCell(item)}

</div>

)

}

}

})

]

return(

<div style={{padding:16}}>

<Card>

<Space>

<Select
style={{width:260}}
value={periodId}
onChange={setPeriodId}
options={periods.map(p=>({
value:p.id,
label:`${p.academicYear} · ${p.term}`
}))}
/>

<Input.Search
placeholder="Öğrenci ara"
value={search}
onChange={(e)=>setSearch(e.target.value)}
style={{width:260}}
/>

{periodMeta && (
<Tag color="purple">Aktif Hafta: {periodMeta.currentWeekNo}</Tag>
)}

</Space>

</Card>

<Card title="Koordinatör Kontrol Paneli" style={{marginTop:16}}>

<Table
rowKey="studentId"
loading={loading}
columns={columns}
dataSource={filteredRows}
pagination={{pageSize:20}}
scroll={{x:2100}}
onRow={(record)=>({
onClick:()=>{
setActiveRow(record)
setDrawerOpen(true)
}
})}
/>

</Card>

{/* RAPOR DRAWER */}

<Drawer
open={reportDetailOpen}
onClose={()=>setReportDetailOpen(false)}
width={900}
title="Haftalık Rapor Detayı"
>

{reportDetailLoading ? (

<div style={{padding:40,textAlign:"center"}}>
<Spin/>
</div>

) : !reportDetail ? (

<Empty description="Rapor bulunamadı"/>

) : (

<Space direction="vertical" style={{width:"100%"}} size={16}>

<Card>

<Title level={4}>{reportDetailMeta?.nameSurname}</Title>

<Space>
<Tag>{reportDetailMeta?.studentNo}</Tag>
<Tag color="blue">Hafta {reportDetailMeta?.weekNo}</Tag>
<Tag color="green">Toplam Puan: {reportDetail?.totalScore}</Tag>
</Space>

</Card>

<Card title="Rapor Soruları">

{(reportDetail.questions||[]).map((q,i)=>(

<Card key={q.id} size="small" style={{marginBottom:12}}>

<Text strong>{i+1}. {q.text}</Text>

<Divider/>

<div style={{
padding:12,
background:"#fafafa",
border:"1px solid #f0f0f0",
borderRadius:8
}}>
{q.answerText}
</div>

<Space style={{marginTop:10}}>
<Tag color="blue">Max: {q.points}</Tag>
<Tag color="green">Puan: {q.score}</Tag>
</Space>

</Card>

))}

</Card>

</Space>

)}

</Drawer>

</div>

)

}