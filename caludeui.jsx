import { useState, useRef } from "react";

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #07090f; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { opacity: 0.3; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #0d1017; }
  ::-webkit-scrollbar-thumb { background: #1c2333; border-radius: 10px; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
`;

const T = {
  bg:"#07090f", surface:"#0d1017", surface2:"#111520", surface3:"#161b28",
  border:"#1c2333", border2:"#242d40", text:"#e2e8f4", muted:"#8892a4", dim:"#3d4a60",
  y1:"#f59e0b", y2:"#6366f1", y3:"#10b981", y4:"#ec4899",
  s1:"#f97316", s2:"#3b82f6", s3:"#a855f7",
};

const yearColor = y => ({
  "1st Year":T.y1, "2nd Year":T.y2, "3rd Year":T.y3, "4th Year":T.y4
}[y]||T.muted);

const stageColor = s => s===1?T.s1:s===2?T.s2:T.s3;

// KEY: stage is per-year. All courses in a year share one stage.
const YEAR_STAGES = {
  "1st Year": { stage:1, label:"Stage 1", desc:"Term Start → TT1",  color:T.s1 },
  "2nd Year": { stage:2, label:"Stage 2", desc:"TT1 → TT2",         color:T.s2 },
  "3rd Year": { stage:3, label:"Stage 3", desc:"TT2 → Finals",       color:T.s3 },
  "4th Year": { stage:2, label:"Stage 2", desc:"TT1 → TT2",         color:T.s2 },
};

const PROFESSOR = { name:"Dr. Kavitha Rao", id:"FET-CSE-2018-047", dept:"Computer Science & Engineering", role:"Associate Professor", initials:"KR", email:"kavitha.rao@msruas.ac.in" };

const COURSES = [
  { id:"c1", code:"MA101", title:"Engineering Mathematics I",       year:"1st Year", dept:"CSE", sem:1, sections:["A","B","C"], enrolled:[62,58,60], att:[82,79,85], tt1Done:false, tt2Done:false },
  { id:"c2", code:"CS101", title:"Problem Solving with C",          year:"1st Year", dept:"CSE", sem:1, sections:["A"],         enrolled:[62],       att:[88],       tt1Done:false, tt2Done:false },
  { id:"c3", code:"CS401", title:"Design & Analysis of Algorithms", year:"2nd Year", dept:"CSE", sem:4, sections:["A","B"],     enrolled:[58,56],    att:[76,80],    tt1Done:true,  tt2Done:false },
  { id:"c4", code:"CS403", title:"Operating Systems",               year:"2nd Year", dept:"CSE", sem:4, sections:["C"],         enrolled:[54],       att:[71],       tt1Done:true,  tt2Done:false },
  { id:"c5", code:"MA301", title:"Engineering Mathematics III",     year:"2nd Year", dept:"ECE", sem:3, sections:["A"],         enrolled:[60],       att:[74],       tt1Done:true,  tt2Done:false },
  { id:"c6", code:"CS601", title:"Compiler Design",                 year:"3rd Year", dept:"CSE", sem:6, sections:["A"],         enrolled:[52],       att:[78],       tt1Done:true,  tt2Done:true  },
  { id:"c7", code:"CS603", title:"Information Security",            year:"3rd Year", dept:"CSE", sem:6, sections:["B"],         enrolled:[50],       att:[81],       tt1Done:true,  tt2Done:true  },
  { id:"c8", code:"CS702", title:"Deep Learning & Neural Networks", year:"4th Year", dept:"CSE", sem:7, sections:["A"],         enrolled:[45],       att:[85],       tt1Done:true,  tt2Done:false },
];

function getPending(c, stage) {
  if (stage===1 && !c.tt1Done) return "Setup TT1 Paper";
  if (stage===2 && c.tt1Done && !c.tt2Done) return "Enter TT1 Marks";
  if (stage===3 && c.tt2Done) return "Finalise Attendance";
  return null;
}

const OFFERINGS = COURSES.flatMap(c =>
  c.sections.map((sec,i) => ({
    ...c, offId:`${c.id}-${sec}`, section:sec, count:c.enrolled[i],
    attendance:c.att[i], stage:YEAR_STAGES[c.year].stage,
    stageInfo:YEAR_STAGES[c.year], pendingAction:getPending(c, YEAR_STAGES[c.year].stage),
  }))
);

const YEAR_GROUPS = ["1st Year","2nd Year","3rd Year","4th Year"].map(yr => ({
  year:yr, color:yearColor(yr), stageInfo:YEAR_STAGES[yr],
  offerings:OFFERINGS.filter(o=>o.year===yr),
})).filter(g=>g.offerings.length>0);

const NAMES = ["Aarav Sharma","Aditi Nair","Akshay Kulkarni","Akshitha Reddy","Ananya Iyer","Anika Patel","Arjun Menon","Arnav Gupta","Bhavya Shetty","Chirag Joshi","Deepika Rao","Dhruv Verma","Divya Krishnamurthy","Esha Banerjee","Farhan Khan","Geetika Singh","Harsh Patel","Ishaan Dubey","Ishita Mishra","Jayesh Pillai","Kavya Nambiar","Keerthana Suresh","Kiran Bhat","Kriti Agarwal","Lakshmi Prasad","Manish Tiwari","Meera Sundaram","Mohammed Rizwan","Nandita Gowda","Nikhil Hegde","Nisha Kumar","Omkar Patil","Pallavi Desai","Pranav Rajan","Priya Chandrasekaran","Rahul Saxena","Ranjith Nair","Rashmi Kamath","Ritu Srivastava","Rohan Mehta","Sahana Murthy","Sanjana Bose","Sanket Jain","Shilpa Upadhyay","Shivam Tripathi","Sneha Pillai","Soumya Das","Srikant Venkat","Supriya Rao","Swati Naidu","Tanvi Joshi","Tejashwini Gowda","Uday Shankar","Varun Krishnan","Vidya Anand","Vikram Nair","Vinay Hiremath","Vishal Reddy","Yashaswi Kulkarni","Yash Patel","Zara Ahmed","Zeeshan Siddiqui"];

let seedCounter = 0;
const pseudoRand = (max) => { seedCounter = (seedCounter * 1664525 + 1013904223) & 0x7fffffff; return seedCounter % (max+1); };

const makeStudents = (count, dept, sem, section) => {
  seedCounter = count * 100 + sem * 10 + section.charCodeAt(0);
  return Array.from({length:count},(_,i)=>({
    id:`s${i}`, usn:`1MS23${dept.slice(0,2).toUpperCase()}${String(i+1).padStart(3,"0")}`,
    name:NAMES[i%NAMES.length],
    present: 28 + pseudoRand(15),
    totalClasses:45,
  }));
};

const CO_MAP = {
  CS401:[
    {id:"CO1",desc:"Analyse time & space complexity using asymptotic notation",bloom:"Analyse"},
    {id:"CO2",desc:"Design greedy and divide-and-conquer algorithms",bloom:"Create"},
    {id:"CO3",desc:"Apply dynamic programming to optimisation problems",bloom:"Apply"},
    {id:"CO4",desc:"Implement and evaluate graph algorithms",bloom:"Evaluate"},
    {id:"CO5",desc:"Compare NP-hard problems and approximation strategies",bloom:"Evaluate"},
  ],
  CS403:[
    {id:"CO1",desc:"Explain process scheduling and synchronisation mechanisms",bloom:"Understand"},
    {id:"CO2",desc:"Analyse deadlock conditions and prevention strategies",bloom:"Analyse"},
    {id:"CO3",desc:"Apply memory management and virtual memory techniques",bloom:"Apply"},
    {id:"CO4",desc:"Evaluate file system design and I/O management",bloom:"Evaluate"},
  ],
  MA101:[
    {id:"CO1",desc:"Apply differential calculus to engineering problems",bloom:"Apply"},
    {id:"CO2",desc:"Solve systems of linear equations using matrices",bloom:"Apply"},
    {id:"CO3",desc:"Interpret eigenvalues in engineering context",bloom:"Analyse"},
    {id:"CO4",desc:"Apply integral calculus to compute areas and volumes",bloom:"Apply"},
  ],
  default:[
    {id:"CO1",desc:"Understand and explain core concepts of the subject",bloom:"Understand"},
    {id:"CO2",desc:"Apply theoretical principles to practical problems",bloom:"Apply"},
    {id:"CO3",desc:"Analyse and evaluate solution approaches",bloom:"Analyse"},
    {id:"CO4",desc:"Design solutions for complex engineering scenarios",bloom:"Create"},
    {id:"CO5",desc:"Evaluate trade-offs between different methods",bloom:"Evaluate"},
  ],
};

const PAPER_MAP = {
  CS401:[
    {id:"q1",text:"Prove Big-O complexity of Merge Sort; compare with Quick Sort",maxMarks:8,cos:["CO1"]},
    {id:"q2",text:"Design a greedy solution for Activity Selection Problem",maxMarks:8,cos:["CO2"]},
    {id:"q3",text:"Apply DP to 0/1 Knapsack problem with full derivation",maxMarks:7,cos:["CO3"]},
    {id:"q4",text:"Recurrence relation for D&C; apply Master Theorem",maxMarks:7,cos:["CO1","CO2"]},
  ],
  default:[
    {id:"q1",text:"Answer question 1 — Unit 1 concepts",maxMarks:8,cos:["CO1"]},
    {id:"q2",text:"Answer question 2 — Unit 2 concepts",maxMarks:8,cos:["CO2"]},
    {id:"q3",text:"Answer question 3 — applied problem",maxMarks:7,cos:["CO3"]},
    {id:"q4",text:"Answer question 4 — mixed concepts",maxMarks:7,cos:["CO1","CO2"]},
  ],
};

/* ── tiny components ── */
const mono = {fontFamily:"'JetBrains Mono',monospace"};
const sora = {fontFamily:"'Sora',sans-serif"};
const CO_COLORS = ["#6366f1","#3b82f6","#10b981","#f59e0b","#ec4899","#8b5cf6"];

const Chip = ({children,color=T.muted,size=11}) => (
  <span style={{...mono,fontSize:size,padding:"2px 8px",borderRadius:4,background:`${color}18`,color,border:`1px solid ${color}35`,whiteSpace:"nowrap",display:"inline-block"}}>{children}</span>
);
const Bar = ({val,max=100,color,h=5}) => (
  <div style={{background:T.border,borderRadius:99,height:h,overflow:"hidden",flex:1}}>
    <div style={{height:h,borderRadius:99,width:`${Math.min(100,(val/max)*100)}%`,background:color,transition:"width 0.5s ease"}}/>
  </div>
);
const Card = ({children,style={},glow}) => (
  <div style={{background:T.surface,border:`1px solid ${glow?glow+"35":T.border}`,borderRadius:12,padding:20,boxShadow:glow?`0 0 24px ${glow}10`:"none",...style}}>{children}</div>
);
const Btn = ({children,onClick,variant="primary",size="md"}) => {
  const p=size==="sm"?"6px 14px":"10px 22px", fs=size==="sm"?11:13;
  const base={...sora,fontWeight:600,fontSize:fs,padding:p,borderRadius:7,cursor:"pointer",border:"none",transition:"all 0.15s"};
  if(variant==="primary") return <button onClick={onClick} style={{...base,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff"}}>{children}</button>;
  if(variant==="ghost")   return <button onClick={onClick} style={{...base,background:"transparent",color:T.muted,border:`1px solid ${T.border2}`}}>{children}</button>;
  return <button onClick={onClick} style={{...base,background:T.surface3,color:T.text,border:`1px solid ${T.border2}`}}>{children}</button>;
};
const TH = ({children}) => <th style={{...mono,fontSize:9,color:"#6366f1",letterSpacing:"0.1em",textTransform:"uppercase",padding:"11px 12px",textAlign:"left",background:T.surface2,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap"}}>{children}</th>;
const TD = ({children,style={}}) => <td style={{padding:"9px 12px",borderBottom:`1px solid ${T.border}`,...style}}>{children}</td>;

/* ══════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════ */
function Dashboard({onOpen}) {
  const total = OFFERINGS.reduce((a,o)=>a+o.count,0);
  const pending = OFFERINGS.filter(o=>o.pendingAction).length;
  return (
    <div style={{padding:"32px 40px",maxWidth:1240,margin:"0 auto",animation:"fadeUp 0.35s ease"}}>
      {/* greeting */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}>
        <div style={{width:54,height:54,borderRadius:16,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",...sora,fontWeight:800,fontSize:20,color:"#fff"}}>{PROFESSOR.initials}</div>
        <div>
          <div style={{...sora,fontWeight:700,fontSize:22,color:T.text}}>Good morning, {PROFESSOR.name.split(" ")[0]} 🌅</div>
          <div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>{PROFESSOR.dept} · {PROFESSOR.role} · {PROFESSOR.id}</div>
        </div>
        <div style={{marginLeft:"auto",textAlign:"right"}}>
          <div style={{...mono,fontSize:10,color:T.dim}}>Academic Year</div>
          <div style={{...sora,fontWeight:700,fontSize:14,color:T.text}}>Odd Sem 2025–26</div>
        </div>
      </div>

      {/* stat row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:32}}>
        {[
          {icon:"📚",label:"Course Offerings",val:OFFERINGS.length,color:"#6366f1"},
          {icon:"👥",label:"Total Students",val:total,color:"#10b981"},
          {icon:"⚡",label:"Pending Actions",val:pending,color:"#f59e0b"},
          {icon:"📅",label:"Years Teaching",val:YEAR_GROUPS.length,color:"#ec4899"},
        ].map((s,i)=>(
          <Card key={i} glow={s.color} style={{padding:"16px 20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>{s.icon}</span>
              <div>
                <div style={{...sora,fontWeight:800,fontSize:26,color:s.color}}>{s.val}</div>
                <div style={{...mono,fontSize:10,color:T.muted}}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* year sections */}
      {YEAR_GROUPS.map(g=><YearSection key={g.year} group={g} onOpen={onOpen}/>)}

      {/* summary table */}
      <SummaryTable onOpen={onOpen}/>
    </div>
  );
}

function YearSection({group,onOpen}) {
  const {year,color,stageInfo,offerings} = group;
  const [collapsed,setCollapsed] = useState(false);
  const totalStudents = offerings.reduce((a,o)=>a+o.count,0);
  const avgAtt = Math.round(offerings.reduce((a,o)=>a+o.attendance,0)/offerings.length);
  const pendingCount = offerings.filter(o=>o.pendingAction).length;

  return (
    <div style={{marginBottom:28}}>
      <div onClick={()=>setCollapsed(c=>!c)} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",background:`${color}0c`,border:`1px solid ${color}28`,borderRadius:10,marginBottom:collapsed?0:14,cursor:"pointer",transition:"all 0.2s"}}>
        <div style={{...sora,fontWeight:800,fontSize:14,color,background:`${color}18`,border:`1px solid ${color}40`,padding:"3px 12px",borderRadius:6}}>{year}</div>
        <div style={{...mono,fontSize:11,color:stageInfo.color,background:`${stageInfo.color}15`,border:`1px solid ${stageInfo.color}35`,padding:"3px 10px",borderRadius:5}}>{stageInfo.label} · {stageInfo.desc}</div>
        <div style={{display:"flex",gap:3,maxWidth:140}}>
          {[1,2,3].map(s=><div key={s} style={{flex:1,height:5,borderRadius:2,background:s<=stageInfo.stage?stageColor(s):T.border}}/>)}
        </div>
        <div style={{...mono,fontSize:11,color:T.muted}}>{offerings.length} offering{offerings.length>1?"s":""} · {totalStudents} students · avg att {avgAtt}%</div>
        {pendingCount>0&&<div style={{...mono,fontSize:10,color:"#f59e0b",background:"#f59e0b12",border:"1px solid #f59e0b30",padding:"3px 9px",borderRadius:5}}>⚡ {pendingCount} pending</div>}
        <div style={{...mono,fontSize:12,color:T.dim,marginLeft:"auto"}}>{collapsed?"▾":"▴"}</div>
      </div>
      {!collapsed&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(305px,1fr))",gap:13,animation:"fadeUp 0.25s ease"}}>
          {offerings.map(o=><OfferingCard key={o.offId} o={o} yc={color} onOpen={onOpen}/>)}
        </div>
      )}
    </div>
  );
}

function OfferingCard({o,yc,onOpen}) {
  const [hov,setHov] = useState(false);
  const sc = o.stageInfo.color;
  const ac = o.attendance>=75?"#10b981":o.attendance>=65?"#f59e0b":"#ef4444";
  const checks = [o.tt1Done,o.tt2Done,o.attendance>=75];
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>onOpen(o)}
      style={{background:T.surface,border:`1px solid ${hov?yc+"50":T.border}`,borderRadius:12,padding:"18px 20px",cursor:"pointer",transition:"all 0.2s",transform:hov?"translateY(-3px)":"none",boxShadow:hov?`0 10px 28px ${yc}12`:"none",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${yc},${sc})`}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{...mono,fontSize:10,color:yc,marginBottom:3}}>{o.code} · {o.dept} · Sec {o.section}</div>
          <div style={{...sora,fontWeight:700,fontSize:15,color:T.text,lineHeight:1.25,maxWidth:200}}>{o.title}</div>
        </div>
        <Chip color={sc}>{o.stageInfo.label}</Chip>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        <Chip color={T.dim}>Sem {o.sem}</Chip>
        <Chip color={T.dim}>{o.count} students</Chip>
        <Chip color={ac}>{o.attendance>=75?"Good":o.attendance>=65?"At Risk":"Detained"} · {o.attendance}%</Chip>
      </div>
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",gap:3}}>
          {[1,2,3].map(s=><div key={s} style={{flex:1,height:4,borderRadius:2,background:s<=o.stageInfo.stage?stageColor(s):T.border}}/>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
          <span style={{...mono,fontSize:9,color:T.dim}}>Term Start</span>
          <span style={{...mono,fontSize:9,color:sc}}>{o.stageInfo.desc}</span>
          <span style={{...mono,fontSize:9,color:T.dim}}>Finals</span>
        </div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:11}}>
        <span style={{...mono,fontSize:10,color:T.muted}}>Progress:</span>
        {["TT1","TT2","Att"].map((lbl,i)=>(
          <div key={lbl} style={{display:"flex",alignItems:"center",gap:3}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:checks[i]?"#10b981":T.border2,border:`1.5px solid ${checks[i]?"#10b981":T.dim}`}}/>
            <span style={{...mono,fontSize:9,color:T.dim}}>{lbl}</span>
          </div>
        ))}
      </div>
      {o.pendingAction
        ? <div style={{background:"#f59e0b10",border:"1px solid #f59e0b28",borderRadius:6,padding:"7px 12px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12}}>⚡</span>
            <span style={{...mono,fontSize:11,color:"#f59e0b"}}>{o.pendingAction}</span>
            <span style={{...mono,fontSize:10,color:"#6366f1",marginLeft:"auto"}}>Open →</span>
          </div>
        : <div style={{background:"#10b98110",border:"1px solid #10b98128",borderRadius:6,padding:"7px 12px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12}}>✓</span>
            <span style={{...mono,fontSize:11,color:"#10b981"}}>All caught up</span>
          </div>
      }
    </div>
  );
}

function SummaryTable({onOpen}) {
  return (
    <Card style={{marginTop:8,padding:0,overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`}}>
        <div style={{...sora,fontWeight:700,fontSize:15,color:T.text}}>All Offerings — Quick View</div>
        <div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>{OFFERINGS.length} total across {YEAR_GROUPS.length} years</div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Year","Dept","Code","Course","Sec","Students","Attendance","Stage","TT1","TT2","Pending"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {OFFERINGS.map(o=>{
              const ac=o.attendance>=75?"#10b981":o.attendance>=65?"#f59e0b":"#ef4444";
              const yc=yearColor(o.year);
              return (
                <tr key={o.offId} onClick={()=>onOpen(o)} style={{cursor:"pointer",transition:"background 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surface2}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <TD><Chip color={yc} size={10}>{o.year}</Chip></TD>
                  <TD style={{...mono,fontSize:11,color:T.muted}}>{o.dept}</TD>
                  <TD style={{...mono,fontSize:11,color:yc}}>{o.code}</TD>
                  <TD style={{...sora,fontSize:13,color:T.text,maxWidth:180}}>{o.title}</TD>
                  <TD style={{...mono,fontSize:11,color:T.muted}}>Sec {o.section}</TD>
                  <TD style={{...mono,fontSize:12,fontWeight:600,color:T.text}}>{o.count}</TD>
                  <TD>
                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:110}}>
                      <Bar val={o.attendance} color={ac} h={4}/>
                      <span style={{...mono,fontSize:11,color:ac,minWidth:32}}>{o.attendance}%</span>
                    </div>
                  </TD>
                  <TD><Chip color={o.stageInfo.color} size={10}>{o.stageInfo.label}</Chip></TD>
                  <TD style={{textAlign:"center"}}><span style={{color:o.tt1Done?"#10b981":T.dim,fontSize:14}}>{o.tt1Done?"✓":"—"}</span></TD>
                  <TD style={{textAlign:"center"}}><span style={{color:o.tt2Done?"#10b981":T.dim,fontSize:14}}>{o.tt2Done?"✓":"—"}</span></TD>
                  <TD>{o.pendingAction?<Chip color="#f59e0b" size={10}>{o.pendingAction}</Chip>:<Chip color="#10b981" size={10}>✓ Done</Chip>}</TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════
   COURSE DETAIL
══════════════════════════════════════════════════ */
const TABS = [
  {id:"overview",icon:"🏠",label:"Overview"},
  {id:"attendance",icon:"📅",label:"Attendance"},
  {id:"tt1",icon:"📝",label:"TT1"},
  {id:"tt2",icon:"📝",label:"TT2"},
  {id:"quizzes",icon:"❓",label:"Quizzes"},
  {id:"assignments",icon:"📄",label:"Assignments"},
  {id:"co",icon:"🎯",label:"CO Attainment"},
  {id:"gradebook",icon:"📊",label:"Grade Book"},
];

function CourseDetail({offering:o,onBack}) {
  const [tab,setTab] = useState("overview");
  const yc = yearColor(o.year);
  const sc = o.stageInfo.color;
  const students = makeStudents(o.count, o.dept, o.sem, o.section);
  const cos = CO_MAP[o.code]||CO_MAP.default;
  const paper = PAPER_MAP[o.code]||PAPER_MAP.default;
  const tabLocked = t => (t==="tt2"&&o.stageInfo.stage<2)||(t==="co"&&!o.tt1Done);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"18px 36px"}}>
        <button onClick={onBack} style={{...mono,fontSize:11,color:"#6366f1",background:"none",border:"none",cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",gap:5,padding:0}}>← Back to Dashboard</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
              <Chip color={yc}>{o.year}</Chip><Chip color={T.muted}>{o.dept}</Chip>
              <Chip color={T.muted}>Sem {o.sem}</Chip><Chip color={T.muted}>Sec {o.section}</Chip>
              <Chip color={sc}>{o.stageInfo.label} · {o.stageInfo.desc}</Chip>
            </div>
            <div style={{...sora,fontWeight:800,fontSize:22,color:T.text}}>
              <span style={{color:yc}}>{o.code}</span> — {o.title}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}><Btn variant="ghost" size="sm">📥 Export</Btn></div>
        </div>
        {/* stepper */}
        <div style={{display:"flex",alignItems:"center",gap:0,marginTop:16,maxWidth:480}}>
          {["Term Start","TT1","TT2","Finals"].map((lbl,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",flex:i<3?1:0}}>
              <div style={{width:26,height:26,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",...mono,fontSize:11,fontWeight:700,background:i<o.stageInfo.stage?stageColor(i+1):T.border2,border:`2px solid ${i<o.stageInfo.stage?stageColor(i+1):T.dim}`,color:i<o.stageInfo.stage?"#fff":T.dim}}>
                {i<o.stageInfo.stage?"✓":i+1}
              </div>
              <span style={{...mono,fontSize:9,color:i<o.stageInfo.stage?T.muted:T.dim,marginLeft:5,whiteSpace:"nowrap"}}>{lbl}</span>
              {i<3&&<div style={{flex:1,height:2,background:i<o.stageInfo.stage-1?stageColor(i+1):T.border,margin:"0 7px"}}/>}
            </div>
          ))}
        </div>
        {/* tabs */}
        <div style={{display:"flex",gap:0,marginTop:18,borderBottom:`1px solid ${T.border}`,marginBottom:-19,marginLeft:-36,marginRight:-36,paddingLeft:36,overflowX:"auto"}}>
          {TABS.map(t=>{
            const locked=tabLocked(t.id);
            return (
              <button key={t.id} onClick={()=>!locked&&setTab(t.id)}
                style={{...mono,fontSize:12,padding:"10px 15px",background:"none",border:"none",cursor:locked?"not-allowed":"pointer",color:tab===t.id?"#818cf8":locked?T.dim:T.muted,borderBottom:`2px solid ${tab===t.id?"#6366f1":"transparent"}`,opacity:locked?0.4:1,whiteSpace:"nowrap",transition:"color 0.15s",display:"flex",alignItems:"center",gap:5}}>
                {t.icon} {t.label}{locked?" 🔒":""}
              </button>
            );
          })}
        </div>
      </div>
      {/* content */}
      <div style={{flex:1,overflowY:"auto",background:T.bg}}>
        {tab==="overview"    && <OverviewTab    o={o} cos={cos} students={students} setTab={setTab}/>}
        {tab==="attendance"  && <AttendanceTab  o={o} students={students}/>}
        {tab==="tt1"         && <TTTab          o={o} ttNum={1} cos={cos} paper={paper} students={students}/>}
        {tab==="tt2"         && <TTTab          o={o} ttNum={2} cos={cos} paper={paper} students={students}/>}
        {tab==="quizzes"     && <QuizzesTab     o={o} students={students}/>}
        {tab==="assignments" && <AssignmentsTab o={o} students={students}/>}
        {tab==="co"          && <COTab          o={o} cos={cos} paper={paper} students={students}/>}
        {tab==="gradebook"   && <GradeBookTab   o={o} cos={cos} paper={paper} students={students}/>}
      </div>
    </div>
  );
}

/* ── Overview ── */
function OverviewTab({o,cos,students,setTab}) {
  const det  = students.filter(s=>s.present/s.totalClasses<0.65).length;
  const risk = students.filter(s=>{const p=s.present/s.totalClasses;return p>=0.65&&p<0.75;}).length;
  const good = students.length-det-risk;
  const checks=[
    {lbl:"Attendance tracked",done:true,tab:"attendance"},
    {lbl:"TT1 paper CO mapped",done:o.tt1Done,tab:"tt1"},
    {lbl:"TT1 marks entered",done:o.tt1Done,tab:"tt1"},
    {lbl:"Quiz 1 marks entered",done:o.tt1Done,tab:"quizzes"},
    {lbl:"Assignment 1 marks entered",done:false,tab:"assignments"},
    {lbl:"TT2 paper CO mapped",done:o.stageInfo.stage>2,tab:"tt2"},
    {lbl:"TT2 marks entered",done:o.tt2Done,tab:"tt2"},
    {lbl:"Quiz 2 marks entered",done:false,tab:"quizzes"},
    {lbl:"Assignment 2 marks entered",done:false,tab:"assignments"},
    {lbl:"Attendance finalised",done:o.stageInfo.stage>=3,tab:"attendance"},
    {lbl:"SEE marks submitted",done:false,tab:"gradebook"},
  ];
  const doneCount=checks.filter(c=>c.done).length;
  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{...sora,fontWeight:700,fontSize:16,color:T.text}}>Semester Checklist</div>
            <div style={{...mono,fontSize:11,color:"#10b981"}}>{doneCount}/{checks.length}</div>
          </div>
          <Bar val={doneCount} max={checks.length} color="#10b981" h={6}/>
          <div style={{height:14}}/>
          {checks.map((c,i)=>(
            <div key={i} onClick={()=>setTab(c.tab)} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:i<checks.length-1?`1px solid ${T.border}`:"none",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div style={{width:19,height:19,borderRadius:"50%",flexShrink:0,background:c.done?"#10b98120":T.surface3,border:`2px solid ${c.done?"#10b981":T.dim}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#10b981"}}>{c.done?"✓":""}</div>
              <span style={{...mono,fontSize:12,color:c.done?T.muted:T.text,flex:1,textDecoration:c.done?"line-through":"none"}}>{c.lbl}</span>
              {!c.done&&<span style={{...mono,fontSize:10,color:"#6366f1"}}>→</span>}
            </div>
          ))}
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card>
            <div style={{...sora,fontWeight:700,fontSize:15,color:T.text,marginBottom:14}}>Class Health</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[{lbl:"Enrolled",val:o.count,col:"#6366f1"},{lbl:"Good (≥75%)",val:good,col:"#10b981"},{lbl:"At Risk (<75%)",val:risk,col:"#f59e0b"},{lbl:"Detained (<65%)",val:det,col:"#ef4444"}].map((x,i)=>(
                <div key={i} style={{background:T.surface2,borderRadius:8,padding:"11px 14px",border:`1px solid ${x.col}22`}}>
                  <div style={{...sora,fontWeight:800,fontSize:22,color:x.col}}>{x.val}</div>
                  <div style={{...mono,fontSize:10,color:T.muted}}>{x.lbl}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:0,height:8,borderRadius:6,overflow:"hidden",marginTop:14}}>
              {[{val:good,col:"#10b981"},{val:risk,col:"#f59e0b"},{val:det,col:"#ef4444"}].map((x,i)=>(
                <div key={i} style={{flex:x.val,background:x.col,minWidth:x.val>0?2:0}}/>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{...sora,fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>Course Outcomes</div>
            {cos.map((co,i)=>{
              const c=CO_COLORS[i%CO_COLORS.length];
              return (
                <div key={co.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0",borderBottom:i<cos.length-1?`1px solid ${T.border}`:"none"}}>
                  <div style={{...mono,fontSize:10,fontWeight:600,color:c,background:`${c}18`,border:`1px solid ${c}35`,borderRadius:4,padding:"2px 6px",flexShrink:0,marginTop:1}}>{co.id}</div>
                  <div>
                    <div style={{fontSize:12,color:T.text,lineHeight:1.4}}>{co.desc}</div>
                    <div style={{marginTop:3}}><Chip color={T.dim} size={10}>{co.bloom}</Chip></div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Attendance ── */
function AttendanceTab({o,students}) {
  const [total,setTotal]=useState(45);
  const [data,setData]=useState(()=>students.map(s=>({...s})));
  const [saved,setSaved]=useState(false);
  const [filter,setFilter]=useState("all");
  const update=(id,val)=>{setData(d=>d.map(s=>s.id===id?{...s,present:Math.min(total,Math.max(0,parseInt(val)||0))}:s));setSaved(false);};
  const filtered=filter==="all"?data:filter==="risk"?data.filter(s=>{const p=s.present/total;return p>=0.65&&p<0.75;}):data.filter(s=>s.present/total<0.65);
  const stats={good:data.filter(s=>s.present/total>=0.75).length,risk:data.filter(s=>{const p=s.present/total;return p>=0.65&&p<0.75;}).length,det:data.filter(s=>s.present/total<0.65).length};
  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{...sora,fontWeight:700,fontSize:18,color:T.text}}>Attendance Register</div>
          <div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>{o.count} students · Sec {o.section}</div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{...mono,fontSize:12,color:T.muted}}>Total classes:
            <input type="number" value={total} onChange={e=>setTotal(parseInt(e.target.value)||1)}
              style={{width:50,...mono,fontSize:12,textAlign:"center",background:T.surface2,border:`1px solid ${T.border2}`,borderRadius:5,color:T.text,padding:"3px 6px",marginLeft:8,outline:"none"}}/>
          </span>
          <Btn size="sm" onClick={()=>setSaved(true)}>{saved?"✓ Saved":"💾 Save"}</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{lbl:"Total",val:o.count,col:"#6366f1",f:"all"},{lbl:"Good ≥75%",val:stats.good,col:"#10b981",f:"all"},{lbl:"At Risk",val:stats.risk,col:"#f59e0b",f:"risk"},{lbl:"Detained",val:stats.det,col:"#ef4444",f:"det"}].map((x,i)=>(
          <div key={i} onClick={()=>setFilter(x.f)} style={{background:filter===x.f?`${x.col}15`:T.surface,border:`1px solid ${filter===x.f?x.col:T.border}35`,borderRadius:10,padding:"13px 18px",flex:"1 1 110px",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{...sora,fontWeight:800,fontSize:22,color:x.col}}>{x.val}</div>
            <div style={{...mono,fontSize:10,color:T.muted}}>{x.lbl}</div>
          </div>
        ))}
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["#","USN","Name","Present","Att %","Marks /10","Status"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {filtered.map((s,i)=>{
                const pct=Math.round(s.present/total*100);
                const attM=pct>=75?10:pct>=65?Math.round((pct-65)/10*10):0;
                const col=pct>=75?"#10b981":pct>=65?"#f59e0b":"#ef4444";
                return (
                  <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <TD style={{...mono,fontSize:11,color:T.dim}}>{i+1}</TD>
                    <TD style={{...mono,fontSize:11,color:"#6366f1"}}>{s.usn}</TD>
                    <TD style={{...sora,fontSize:13,color:T.text,whiteSpace:"nowrap"}}>{s.name}</TD>
                    <TD>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="number" value={s.present} min={0} max={total} onChange={e=>update(s.id,e.target.value)}
                          style={{width:52,...mono,fontSize:12,textAlign:"center",background:T.surface2,border:`1px solid ${T.border2}`,borderRadius:5,color:T.text,padding:"4px 5px",outline:"none"}}/>
                        <span style={{...mono,fontSize:11,color:T.dim}}>/ {total}</span>
                      </div>
                    </TD>
                    <TD>
                      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:110}}>
                        <Bar val={pct} color={col} h={5}/>
                        <span style={{...mono,fontSize:11,color:col,minWidth:34}}>{pct}%</span>
                      </div>
                    </TD>
                    <TD style={{...mono,fontSize:13,fontWeight:700,color:T.text}}>{attM}</TD>
                    <TD><Chip color={col}>{pct>=75?"Good":pct>=65?"At Risk":"Detained"}</Chip></TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0&&<div style={{...mono,fontSize:13,color:T.muted,textAlign:"center",padding:40}}>No students in this category.</div>}
      </Card>
    </div>
  );
}

/* ── TT Tab ── */
function TTTab({o,ttNum,cos,paper,students}) {
  const [step,setStep]=useState("paper");
  const prePopulated = ttNum===1&&o.tt1Done;
  const [marks,setMarks]=useState(()=>{
    const m={};
    let r=0;
    students.forEach(s=>{m[s.id]={};paper.forEach(q=>{r=(r*1664525+1013904223)&0x7fffffff;m[s.id][q.id]=prePopulated?(r%(q.maxMarks+1)):null;});});
    return m;
  });
  const [submitted,setSubmitted]=useState(prePopulated);
  const [saved,setSaved]=useState(false);
  const refs=useRef({});
  const coColorMap=Object.fromEntries(cos.map((c,i)=>[c.id,CO_COLORS[i%CO_COLORS.length]]));
  const totalMax=paper.reduce((a,q)=>a+q.maxMarks,0);
  const coIds=[...new Set(paper.flatMap(q=>q.cos))];
  const getTotal=sid=>paper.reduce((a,q)=>a+(marks[sid]?.[q.id]??0),0);
  const getCOMarks=sid=>{const cm={};coIds.forEach(co=>cm[co]=0);paper.forEach(q=>{const v=marks[sid]?.[q.id]??0;q.cos.forEach(co=>{cm[co]=(cm[co]||0)+v/q.cos.length;});});return cm;};
  const getCOAtt=co=>{const maxCO=paper.filter(q=>q.cos.includes(co)).reduce((a,q)=>a+q.maxMarks/q.cos.length,0);const thr=maxCO*0.5;const pass=students.filter(s=>(getCOMarks(s.id)[co]||0)>=thr).length;return Math.round(pass/students.length*100);};

  // distribution helper
  const Dist=()=>{
    const bins=[0,5,10,15,20,25,30];
    const counts=bins.slice(0,-1).map((b,i)=>students.filter(s=>{const t=getTotal(s.id);return t>=b&&t<bins[i+1];}).length);
    const mx=Math.max(...counts,1);
    return (
      <div style={{display:"flex",gap:4,alignItems:"flex-end",height:50,marginTop:8}}>
        {counts.map((c,i)=>(
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{...mono,fontSize:8,color:T.muted}}>{c||""}</span>
            <div style={{width:"100%",background:"#6366f1",height:`${(c/mx)*40}px`,borderRadius:"2px 2px 0 0",minHeight:2}}/>
            <span style={{...mono,fontSize:8,color:T.dim}}>{bins[i]}</span>
          </div>
        ))}
      </div>
    );
  };

  if(submitted) return (
    <div style={{padding:"28px 36px"}}>
      <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
        <Card style={{flex:"1 1 400px"}}>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20}}>
            <div style={{width:42,height:42,borderRadius:10,background:"#10b98120",border:"1px solid #10b98140",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✅</div>
            <div>
              <div style={{...sora,fontWeight:700,fontSize:16,color:"#10b981"}}>TT{ttNum} Submitted & Locked</div>
              <div style={{...mono,fontSize:11,color:T.muted}}>Pending HoD verification</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
            {[
              {lbl:"Class Avg",val:Math.round(students.reduce((a,s)=>a+getTotal(s.id),0)/students.length)+"/"+totalMax,col:"#6366f1"},
              {lbl:"Pass Rate",val:Math.round(students.filter(s=>getTotal(s.id)>=totalMax*0.4).length/students.length*100)+"%",col:"#10b981"},
              {lbl:"Below 40%",val:students.filter(s=>getTotal(s.id)<totalMax*0.4).length+" stu",col:"#ef4444"},
            ].map((x,i)=>(
              <div key={i} style={{background:T.surface2,borderRadius:8,padding:"11px",textAlign:"center"}}>
                <div style={{...sora,fontWeight:800,fontSize:18,color:x.col}}>{x.val}</div>
                <div style={{...mono,fontSize:9,color:T.muted}}>{x.lbl}</div>
              </div>
            ))}
          </div>
          <div style={{...mono,fontSize:11,color:T.muted,marginBottom:6}}>Marks Distribution</div>
          <Dist/>
          <div style={{marginTop:14}}><Btn size="sm" variant="ghost" onClick={()=>{setSubmitted(false);setStep("marks");}}>Edit (requires HoD unlock)</Btn></div>
        </Card>
        <Card style={{flex:"0 0 270px"}}>
          <div style={{...sora,fontWeight:700,fontSize:14,color:T.text,marginBottom:14}}>CO Attainment from TT{ttNum}</div>
          {coIds.map(co=>{
            const att=getCOAtt(co);const col=coColorMap[co]||T.muted;
            return (
              <div key={co} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><Chip color={col}>{co}</Chip><span style={{...mono,fontSize:13,fontWeight:700,color:att>=60?"#10b981":"#ef4444"}}>{att}%</span></div>
                <div style={{position:"relative"}}><Bar val={att} color={att>=60?"#10b981":"#ef4444"} h={7}/>
                  <div style={{position:"absolute",top:-2,left:"60%",width:1.5,height:11,background:"#f59e0b80"}}/>
                </div>
                <div style={{...mono,fontSize:9,color:T.dim,marginTop:2}}>Target 60% · {att>=60?"✓ Met":"✗ Below"}</div>
              </div>
            );
          })}
        </Card>
      </div>
      <Card style={{marginTop:20,padding:0,overflow:"hidden"}}>
        <div style={{padding:"13px 20px",borderBottom:`1px solid ${T.border}`,...sora,fontWeight:700,fontSize:14,color:T.text}}>Student-wise Marks</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>USN</TH><TH>Name</TH>{paper.map((_,i)=><TH key={i}>Q{i+1}</TH>)}<TH>Total /{totalMax}</TH><TH>Grade</TH></tr></thead>
            <tbody>
              {students.map(s=>{const tot=getTotal(s.id);const pct=tot/totalMax*100;const g=pct>=90?"O":pct>=80?"A+":pct>=70?"A":pct>=60?"B+":pct>=50?"B":pct>=40?"P":"F";
                return (
                  <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <TD style={{...mono,fontSize:10,color:"#6366f1"}}>{s.usn}</TD>
                    <TD style={{...sora,fontSize:12,color:T.text,whiteSpace:"nowrap"}}>{s.name}</TD>
                    {paper.map(q=><TD key={q.id} style={{...mono,fontSize:12,textAlign:"center"}}>{marks[s.id]?.[q.id]??"—"}</TD>)}
                    <TD style={{...mono,fontSize:13,fontWeight:800,textAlign:"center",color:tot>=totalMax*0.5?"#10b981":"#ef4444"}}>{tot}</TD>
                    <TD><Chip color={pct>=40?"#10b981":"#ef4444"}>{g}</Chip></TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{display:"flex",gap:8,marginBottom:22}}>
        {[{id:"paper",lbl:"① Setup Question Paper"},{id:"marks",lbl:"② Enter Marks"}].map(s=>(
          <button key={s.id} onClick={()=>setStep(s.id)} style={{...mono,fontSize:12,padding:"8px 16px",borderRadius:8,cursor:"pointer",background:step===s.id?"#6366f118":"transparent",border:`1px solid ${step===s.id?"#6366f1":T.border}`,color:step===s.id?"#818cf8":T.muted}}>{s.lbl}</button>
        ))}
      </div>

      {step==="paper"&&(
        <div style={{maxWidth:700}}>
          <div style={{...sora,fontWeight:700,fontSize:17,color:T.text,marginBottom:4}}>TT{ttNum} — Question Paper & CO Mapping</div>
          <div style={{...mono,fontSize:12,color:T.muted,marginBottom:16}}>Map each question to COs. Total must equal 30.</div>
          <div style={{background:T.surface2,borderRadius:8,padding:12,marginBottom:16,display:"flex",flexWrap:"wrap",gap:7}}>
            {cos.map(co=>(<div key={co.id} style={{display:"flex",gap:6,alignItems:"center"}}><Chip color={coColorMap[co.id]}>{co.id}</Chip><span style={{...mono,fontSize:10,color:T.dim,maxWidth:150}}>{co.desc.slice(0,36)}…</span></div>))}
          </div>
          <Card style={{padding:0,overflow:"hidden",marginBottom:14}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Q#","Question","Max Marks","Mapped COs"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {paper.map((q,i)=>(
                  <tr key={q.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <TD style={{...mono,fontSize:13,color:"#6366f1",fontWeight:700}}>Q{i+1}</TD>
                    <TD style={{...sora,fontSize:13,color:T.text}}>{q.text}</TD>
                    <TD style={{...mono,fontSize:14,fontWeight:700,color:T.text}}>{q.maxMarks}</TD>
                    <TD><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{q.cos.map(co=><Chip key={co} color={coColorMap[co]||T.muted}>{co}</Chip>)}</div></TD>
                  </tr>
                ))}
                <tr style={{background:T.surface2}}>
                  <TD colSpan={2} style={{...mono,fontSize:12,color:T.muted}}>Total</TD>
                  <TD style={{...mono,fontSize:14,fontWeight:800,color:totalMax===30?"#10b981":"#ef4444"}}>{totalMax} / 30</TD>
                  <TD/>
                </tr>
              </tbody>
            </table>
          </Card>
          {totalMax===30?<Btn onClick={()=>setStep("marks")}>Proceed to Enter Marks →</Btn>:<div style={{...mono,fontSize:12,color:"#ef4444"}}>⚠ Total must be 30. Currently {totalMax}.</div>}
        </div>
      )}

      {step==="marks"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{...sora,fontWeight:700,fontSize:17,color:T.text}}>TT{ttNum} Marks Entry</div>
              <div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>{o.count} students · Tab/Enter to navigate</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="ghost" size="sm" onClick={()=>setSaved(true)}>{saved?"✓ Saved":"💾 Draft"}</Btn>
              <Btn size="sm" onClick={()=>setSubmitted(true)}>Submit & Lock</Btn>
            </div>
          </div>
          <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
                <thead>
                  <tr>
                    <TH>USN</TH><TH>Name</TH>
                    {paper.map((q,i)=>(
                      <th key={q.id} style={{...mono,fontSize:9,color:"#6366f1",letterSpacing:"0.08em",textTransform:"uppercase",padding:"11px 8px",textAlign:"center",background:T.surface2,borderBottom:`1px solid ${T.border}`,minWidth:88}}>
                        Q{i+1} /{q.maxMarks}
                        <div style={{display:"flex",gap:3,justifyContent:"center",marginTop:3}}>{q.cos.map(co=><Chip key={co} color={coColorMap[co]||T.muted} size={9}>{co}</Chip>)}</div>
                      </th>
                    ))}
                    <TH>Total /30</TH>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s,si)=>{
                    const tot=getTotal(s.id);
                    return (
                      <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                        <TD style={{...mono,fontSize:10,color:"#6366f1",whiteSpace:"nowrap"}}>{s.usn}</TD>
                        <TD style={{...sora,fontSize:12,color:T.text,whiteSpace:"nowrap"}}>{s.name}</TD>
                        {paper.map((q,qi)=>{
                          const v=marks[s.id]?.[q.id];const isEmpty=v===null||v===undefined;const pass=!isEmpty&&v>=q.maxMarks*0.5;
                          return (
                            <td key={q.id} style={{padding:"5px 7px",textAlign:"center",borderBottom:`1px solid ${T.border}`}}>
                              <input ref={el=>{if(el)refs.current[`${si}-${qi}`]=el;}} type="number" min={0} max={q.maxMarks}
                                value={isEmpty?"":v}
                                onChange={e=>{const val=e.target.value===""?null:Math.min(q.maxMarks,Math.max(0,parseInt(e.target.value)||0));setMarks(prev=>({...prev,[s.id]:{...prev[s.id],[q.id]:val}}));setSaved(false);}}
                                onKeyDown={e=>{if(e.key==="Tab"||e.key==="Enter"){e.preventDefault();const el=refs.current[`${e.shiftKey?si-1:si+1}-${qi}`];if(el)el.focus();}}}
                                style={{width:48,textAlign:"center",borderRadius:5,background:isEmpty?T.surface2:pass?"#10b98110":"#ef444410",border:`1px solid ${isEmpty?T.border2:pass?"#10b98130":"#ef444430"}`,color:isEmpty?T.muted:pass?"#10b981":"#ef4444",...mono,fontSize:13,padding:"4px",outline:"none"}}
                              />
                            </td>
                          );
                        })}
                        <TD style={{...mono,fontSize:13,fontWeight:700,textAlign:"center",color:tot>=totalMax*0.6?"#10b981":tot>=totalMax*0.4?"#f59e0b":"#ef4444"}}>{tot}</TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div style={{...sora,fontWeight:700,fontSize:14,color:T.text,marginBottom:12}}>Live CO Attainment Preview</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {coIds.map(co=>{const att=getCOAtt(co);const col=coColorMap[co]||T.muted;
                return (
                  <div key={co} style={{background:T.surface2,borderRadius:10,padding:"13px 16px",flex:"1 1 100px",textAlign:"center"}}>
                    <div style={{...mono,fontSize:11,color:col,marginBottom:3}}>{co}</div>
                    <div style={{...sora,fontWeight:800,fontSize:26,color:att>=60?"#10b981":"#ef4444"}}>{att}%</div>
                    <div style={{...mono,fontSize:9,color:T.dim,marginBottom:6}}>Target 60%</div>
                    <Bar val={att} color={att>=60?"#10b981":"#ef4444"} h={6}/>
                    <div style={{...mono,fontSize:9,color:att>=60?"#10b981":"#ef4444",marginTop:4}}>{att>=60?"✓ Met":"✗ Below"}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── Quizzes ── */
function QuizzesTab({o,students}) {
  const quizzes=[{id:"q1",name:"Quiz 1",date:"22 Jul 2025",maxMarks:10,entered:o.tt1Done},{id:"q2",name:"Quiz 2",date:"18 Aug 2025",maxMarks:10,entered:false},{id:"q3",name:"Quiz 3",date:"15 Sep 2025",maxMarks:10,entered:false}];
  const [active,setActive]=useState("q1");
  const [data,setData]=useState(()=>{let r=0;const m={};students.forEach(s=>{m[s.id]={};quizzes.forEach(q=>{r=(r*1664525+1013904223)&0x7fffffff;m[s.id][q.id]=q.entered?(r%11):null;});});return m;});
  const aq=quizzes.find(q=>q.id===active);
  const avg=Math.round(students.reduce((a,s)=>a+(data[s.id]?.[active]??0),0)/students.length);
  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{...sora,fontWeight:700,fontSize:18,color:T.text,marginBottom:20}}>Quizzes <span style={{...mono,fontSize:12,color:T.muted,fontWeight:400}}>— Best 2 of 3 counted</span></div>
      <div style={{display:"flex",gap:12,marginBottom:22}}>
        {quizzes.map(q=>(
          <div key={q.id} onClick={()=>setActive(q.id)} style={{background:active===q.id?"#6366f118":T.surface,border:`1px solid ${active===q.id?"#6366f1":T.border}`,borderRadius:10,padding:"14px 18px",cursor:"pointer",flex:1,transition:"all 0.15s"}}>
            <div style={{...sora,fontWeight:700,fontSize:14,color:T.text}}>{q.name}</div>
            <div style={{...mono,fontSize:11,color:T.muted,marginTop:3}}>{q.date} · /{q.maxMarks}</div>
            <div style={{marginTop:8}}><Chip color={q.entered?"#10b981":"#f59e0b"}>{q.entered?"Entered":"Pending"}</Chip></div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:18}}>
        {[{lbl:"Class Average",val:`${avg}/${aq?.maxMarks}`,col:"#6366f1"},{lbl:"Pass Rate",val:`${Math.round(students.filter(s=>(data[s.id]?.[active]??0)>=aq?.maxMarks*0.4).length/students.length*100)}%`,col:"#10b981"}].map((x,i)=>(
          <Card key={i} style={{flex:1}}><div style={{...sora,fontWeight:800,fontSize:22,color:x.col}}>{x.val}</div><div style={{...mono,fontSize:10,color:T.muted}}>{x.lbl}</div></Card>
        ))}
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"13px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{...sora,fontWeight:700,fontSize:14,color:T.text}}>{aq?.name} — Marks /{aq?.maxMarks}</div>
          <Btn size="sm">💾 Save</Btn>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>#</TH><TH>USN</TH><TH>Name</TH><TH>Marks</TH><TH>Status</TH></tr></thead>
            <tbody>
              {students.map((s,i)=>{
                const v=data[s.id]?.[active];const col=v===null?T.dim:v>=aq.maxMarks*0.6?"#10b981":v>=aq.maxMarks*0.4?"#f59e0b":"#ef4444";
                return (
                  <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <TD style={{...mono,fontSize:11,color:T.dim}}>{i+1}</TD>
                    <TD style={{...mono,fontSize:11,color:"#6366f1"}}>{s.usn}</TD>
                    <TD style={{...sora,fontSize:13,color:T.text,whiteSpace:"nowrap"}}>{s.name}</TD>
                    <TD><input type="number" min={0} max={aq?.maxMarks} defaultValue={v??""}
                      onChange={e=>{const val=e.target.value===""?null:Math.min(aq.maxMarks,Math.max(0,parseInt(e.target.value)||0));setData(d=>({...d,[s.id]:{...d[s.id],[active]:val}}));}}
                      style={{width:58,...mono,fontSize:12,textAlign:"center",background:T.surface2,border:`1px solid ${T.border2}`,borderRadius:5,color:T.text,padding:"4px 5px",outline:"none"}}/></TD>
                    <TD>{v!==null?<Chip color={col}>{v>=aq.maxMarks*0.6?"Good":v>=aq.maxMarks*0.4?"Pass":"Below"}</Chip>:<Chip color={T.dim}>—</Chip>}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Assignments ── */
function AssignmentsTab({o,students}) {
  const asgns=[{id:"a1",name:"Assignment 1",topic:"Complexity Analysis & Sorting",due:"01 Aug 2025",maxMarks:10,entered:o.tt1Done,cos:["CO1"]},{id:"a2",name:"Assignment 2",topic:"DP and Graph Problems",due:"05 Sep 2025",maxMarks:10,entered:false,cos:["CO3","CO4"]}];
  const [active,setActive]=useState("a1");
  const [data,setData]=useState(()=>{let r=0;const m={};students.forEach(s=>{m[s.id]={};asgns.forEach(a=>{r=(r*1664525+1013904223)&0x7fffffff;m[s.id][a.id]=a.entered?(6+(r%5)):null;});});return m;});
  const aa=asgns.find(a=>a.id===active);
  const avg=Math.round(students.reduce((a,s)=>a+(data[s.id]?.[active]??0),0)/students.length);
  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{...sora,fontWeight:700,fontSize:18,color:T.text,marginBottom:20}}>Assignments</div>
      <div style={{display:"flex",gap:14,marginBottom:22}}>
        {asgns.map(a=>(
          <div key={a.id} onClick={()=>setActive(a.id)} style={{background:active===a.id?"#6366f118":T.surface,border:`1px solid ${active===a.id?"#6366f1":T.border}`,borderRadius:10,padding:"15px 18px",cursor:"pointer",flex:1,transition:"all 0.15s"}}>
            <div style={{...sora,fontWeight:700,fontSize:14,color:T.text}}>{a.name}</div>
            <div style={{...mono,fontSize:12,color:T.muted,margin:"4px 0"}}>{a.topic}</div>
            <div style={{...mono,fontSize:11,color:T.dim}}>Due {a.due} · /{a.maxMarks}</div>
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>{a.cos.map(co=><Chip key={co} color="#6366f1">{co}</Chip>)}<Chip color={a.entered?"#10b981":"#f59e0b"}>{a.entered?"Entered":"Pending"}</Chip></div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:18}}>
        {[{lbl:"Class Avg",val:`${avg}/${aa?.maxMarks}`,col:"#6366f1"},{lbl:"Scored ≥60%",val:`${Math.round(students.filter(s=>(data[s.id]?.[active]??0)>=aa?.maxMarks*0.6).length/students.length*100)}%`,col:"#10b981"}].map((x,i)=>(
          <Card key={i} style={{flex:1}}><div style={{...sora,fontWeight:800,fontSize:22,color:x.col}}>{x.val}</div><div style={{...mono,fontSize:10,color:T.muted}}>{x.lbl}</div></Card>
        ))}
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"13px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{...sora,fontWeight:700,fontSize:14,color:T.text}}>{aa?.name} — /{aa?.maxMarks}</div>
          <Btn size="sm">💾 Save</Btn>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>#</TH><TH>USN</TH><TH>Name</TH><TH>Marks</TH><TH>% Score</TH></tr></thead>
            <tbody>
              {students.map((s,i)=>{
                const v=data[s.id]?.[active];const pct=v!==null&&aa?Math.round(v/aa.maxMarks*100):null;
                return (
                  <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <TD style={{...mono,fontSize:11,color:T.dim}}>{i+1}</TD>
                    <TD style={{...mono,fontSize:11,color:"#6366f1"}}>{s.usn}</TD>
                    <TD style={{...sora,fontSize:13,color:T.text,whiteSpace:"nowrap"}}>{s.name}</TD>
                    <TD><input type="number" min={0} max={aa?.maxMarks} defaultValue={v??""}
                      style={{width:58,...mono,fontSize:12,textAlign:"center",background:T.surface2,border:`1px solid ${T.border2}`,borderRadius:5,color:T.text,padding:"4px 5px",outline:"none"}}/></TD>
                    <TD>{pct!==null?<div style={{display:"flex",alignItems:"center",gap:8,minWidth:100}}><Bar val={pct} color={pct>=60?"#10b981":"#ef4444"} h={5}/><span style={{...mono,fontSize:11,color:pct>=60?"#10b981":"#ef4444"}}>{pct}%</span></div>:<Chip color={T.dim}>—</Chip>}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── CO Attainment ── */
function COTab({o,cos,paper}) {
  const target=60;
  const getAtt=(coId,src)=>{const vals={CO1:{tt1:72,assignment:78},CO2:{tt1:58,assignment:65},CO3:{tt1:48},CO4:{},CO5:{}};return vals[coId]?.[src]??null;};
  const weighted=coId=>{const t1=getAtt(coId,"tt1"),a=getAtt(coId,"assignment");if(t1===null)return null;return Math.round((t1||0)*0.3+(a||0)*0.1);};
  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{...sora,fontWeight:700,fontSize:18,color:T.text}}>CO Attainment Report</div>
          <div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>Target: {target}% · Source: TT1 + Assignment data (TT2 & SEE pending)</div>
        </div>
        <Btn variant="ghost" size="sm">📥 Export NBA Format</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:13,marginBottom:26}}>
        {cos.map((co,i)=>{
          const val=getAtt(co.id,"tt1");const col=CO_COLORS[i%CO_COLORS.length];
          return (
            <Card key={co.id} glow={col} style={{textAlign:"center",padding:"16px 12px"}}>
              <div style={{...mono,fontSize:11,color:col,marginBottom:5}}>{co.id}</div>
              <div style={{...sora,fontWeight:800,fontSize:32,color:val===null?T.dim:val>=target?"#10b981":"#ef4444",marginBottom:3}}>{val!==null?`${val}%`:"—"}</div>
              <div style={{...mono,fontSize:9,color:T.dim,marginBottom:8}}>{val!==null?(val>=target?"✓ Target Met":"✗ Below Target"):"No data yet"}</div>
              <div style={{position:"relative"}}>
                <Bar val={val??0} color={val===null?T.border:val>=target?"#10b981":"#ef4444"} h={7}/>
                <div style={{position:"absolute",top:-2,left:`${target}%`,width:1.5,height:11,background:"#f59e0b"}}/>
              </div>
              <div style={{...mono,fontSize:8,color:T.dim,marginTop:3}}>▲ {target}% target</div>
            </Card>
          );
        })}
      </div>
      <Card style={{padding:0,overflow:"hidden",marginBottom:18}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["CO","Description","Bloom","TT1 (30%)","TT2 (30%)","Assignment (10%)","SEE (50%)","Weighted","Status"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {cos.map((co,i)=>{
              const t1=getAtt(co.id,"tt1"),t2=null,a=getAtt(co.id,"assignment"),see=null,wf=weighted(co.id);const col=CO_COLORS[i%CO_COLORS.length];
              return (
                <tr key={co.id} style={{borderBottom:`1px solid ${T.border}`}}>
                  <TD><Chip color={col}>{co.id}</Chip></TD>
                  <TD style={{...sora,fontSize:12,color:T.text,maxWidth:220}}>{co.desc}</TD>
                  <TD><Chip color={T.dim} size={10}>{co.bloom}</Chip></TD>
                  {[t1,t2,a,see].map((v,j)=><TD key={j} style={{...mono,fontSize:13,fontWeight:700,color:v===null?T.dim:v>=target?"#10b981":"#ef4444"}}>{v!==null?`${v}%`:"—"}</TD>)}
                  <TD style={{...mono,fontSize:14,fontWeight:800,color:wf===null?T.dim:wf>=target?"#10b981":"#ef4444"}}>{wf!==null?`${wf}%`:"—"}</TD>
                  <TD>{wf===null?<Chip color={T.dim}>Pending</Chip>:wf>=target?<Chip color="#10b981">✓ Met</Chip>:<Chip color="#ef4444">✗ Below</Chip>}</TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {cos.some(co=>{const v=weighted(co.id);return v!==null&&v<target;})&&(
        <Card glow="#f59e0b">
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <span style={{fontSize:20}}>⚠️</span>
            <div>
              <div style={{...sora,fontWeight:700,fontSize:14,color:"#f59e0b",marginBottom:6}}>Remediation Recommended</div>
              {cos.filter(co=>{const v=weighted(co.id);return v!==null&&v<target;}).map(co=>(
                <div key={co.id} style={{...mono,fontSize:12,color:T.muted,marginBottom:4}}>
                  · <span style={{color:T.text}}>{co.id}</span>: {weighted(co.id)}% — consider revision sessions on "{co.desc.toLowerCase().slice(0,40)}…"
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Grade Book ── */
function GradeBookTab({o,cos,paper,students}) {
  const totalC=45;let r=0;
  const rows=students.map(s=>{
    const pct=Math.round(s.present/totalC*100);
    const attM=pct>=75?10:pct>=65?Math.round((pct-65)/10*10):0;
    r=(r*1664525+1013904223)&0x7fffffff;const tt1r=r%31;const tt1s=Math.round(tt1r/30*15);
    r=(r*1664525+1013904223)&0x7fffffff;const tt2r=o.tt2Done?(r%31):null;const tt2s=tt2r!==null?Math.round(tt2r/30*15):null;
    r=(r*1664525+1013904223)&0x7fffffff;const qz=o.tt1Done?(1+(r%10)):null;
    r=(r*1664525+1013904223)&0x7fffffff;const ag=o.tt1Done?(6+(r%5)):null;
    const ce=attM+tt1s+(tt2s??0)+(qz??0)+(ag??0);
    return {...s,attM,tt1s,tt2s,qz,ag,ce};
  });
  const ceAvg=Math.round(rows.reduce((a,r)=>a+r.ce,0)/rows.length);
  return (
    <div style={{padding:"28px 36px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{...sora,fontWeight:700,fontSize:18,color:T.text}}>Grade Book</div>
          <div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>Consolidated CE marks. SEE entry unlocked by Exam Section after finals.</div>
        </div>
        <div style={{display:"flex",gap:10}}><Btn variant="ghost" size="sm">📥 Export Excel</Btn><Btn variant="ghost" size="sm">🖨 Print</Btn></div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{lbl:"CE Average /50",val:`${ceAvg}/50`,col:"#6366f1"},{lbl:"CE Pass (≥20)",val:rows.filter(r=>r.ce>=20).length,col:"#10b981"},{lbl:"CE Fail Risk",val:rows.filter(r=>r.ce<20).length,col:"#ef4444"},{lbl:"SEE Pending",val:rows.length,col:"#f59e0b"}].map((x,i)=>(
          <Card key={i} style={{flex:"1 1 130px"}}><div style={{...sora,fontWeight:800,fontSize:22,color:x.col}}>{x.val}</div><div style={{...mono,fontSize:10,color:T.muted}}>{x.lbl}</div></Card>
        ))}
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["USN","Name","Att /10","TT1 /15","TT2 /15","Quiz /10","Asgn /10","CE /50","SEE /50","Total","Grade"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {rows.map(r=>{
                const ceCol=r.ce>=25?"#10b981":r.ce>=20?"#f59e0b":"#ef4444";
                return (
                  <tr key={r.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <TD style={{...mono,fontSize:10,color:"#6366f1"}}>{r.usn}</TD>
                    <TD style={{...sora,fontSize:12,color:T.text,whiteSpace:"nowrap"}}>{r.name}</TD>
                    {[{v:r.attM,m:10},{v:r.tt1s,m:15},{v:r.tt2s,m:15},{v:r.qz,m:10},{v:r.ag,m:10}].map((x,j)=>(
                      <TD key={j} style={{...mono,fontSize:12,textAlign:"center",color:x.v===null?T.dim:x.v>=x.m*0.6?"#10b981":x.v>=x.m*0.4?"#f59e0b":"#ef4444"}}>{x.v!==null?x.v:"—"}</TD>
                    ))}
                    <TD style={{...mono,fontSize:13,fontWeight:800,textAlign:"center",color:ceCol}}>{r.ce}</TD>
                    <TD style={{...mono,fontSize:11,textAlign:"center",color:T.dim}}>—</TD>
                    <TD style={{...mono,fontSize:11,textAlign:"center",color:T.dim}}>—</TD>
                    <TD><Chip color={T.dim} size={10}>Pending SEE</Chip></TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{...mono,fontSize:11,color:T.muted,marginTop:12}}>ℹ SEE marks will be unlocked after semester-end examinations. Final grades auto-computed on entry.</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SIDEBAR PAGES
══════════════════════════════════════════════════ */
function AllStudentsPage() {
  const [search,setSearch]=useState("");
  const all=OFFERINGS.flatMap(o=>makeStudents(Math.min(o.count,8),o.dept,o.sem,o.section).map(s=>({...s,code:o.code,title:o.title,year:o.year,section:o.section})));
  const fil=search?all.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.usn.toLowerCase().includes(search.toLowerCase())):all;
  return (
    <div style={{padding:"28px 40px",maxWidth:1200}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><div style={{...sora,fontWeight:700,fontSize:20,color:T.text}}>All My Students</div><div style={{...mono,fontSize:11,color:T.muted,marginTop:2}}>Showing first 8 per offering for demo</div></div>
        <input placeholder="Search name or USN…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{...mono,fontSize:12,background:T.surface2,border:`1px solid ${T.border2}`,borderRadius:8,color:T.text,padding:"8px 16px",outline:"none",width:220}}/>
      </div>
      <Card style={{padding:0,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>USN</TH><TH>Name</TH><TH>Course</TH><TH>Year</TH><TH>Sec</TH><TH>Attendance</TH></tr></thead>
          <tbody>
            {fil.map((s,i)=>{
              const pct=Math.round(s.present/s.totalClasses*100);const col=pct>=75?"#10b981":pct>=65?"#f59e0b":"#ef4444";
              return (
                <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                  <TD style={{...mono,fontSize:11,color:"#6366f1"}}>{s.usn}</TD>
                  <TD style={{...sora,fontSize:13,color:T.text,whiteSpace:"nowrap"}}>{s.name}</TD>
                  <TD style={{...mono,fontSize:11,color:T.muted}}>{s.code} – {s.title.slice(0,25)}</TD>
                  <TD><Chip color={yearColor(s.year)} size={10}>{s.year}</Chip></TD>
                  <TD style={{...mono,fontSize:11,color:T.muted}}>Sec {s.section}</TD>
                  <TD><div style={{display:"flex",alignItems:"center",gap:8,minWidth:110}}><Bar val={pct} color={col} h={4}/><span style={{...mono,fontSize:11,color:col}}>{pct}%</span></div></TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CalendarPage() {
  const events=[
    {date:"22 Jul",lbl:"Quiz 1 — CS401 Sec A/B",type:"quiz",year:"2nd Year"},
    {date:"01 Aug",lbl:"Assignment 1 Due — CS401 all sections",type:"asgn",year:"2nd Year"},
    {date:"05 Aug",lbl:"TT1 — All 1st Year courses (MA101, CS101)",type:"tt",year:"1st Year"},
    {date:"12 Aug",lbl:"TT2 — All 3rd Year courses (CS601, CS603)",type:"tt",year:"3rd Year"},
    {date:"18 Aug",lbl:"Quiz 2 — CS403 Sec C",type:"quiz",year:"2nd Year"},
    {date:"25 Aug",lbl:"TT2 — All 2nd Year courses (CS401, CS403, MA301)",type:"tt",year:"2nd Year"},
    {date:"26 Aug",lbl:"TT2 — 4th Year CS702",type:"tt",year:"4th Year"},
    {date:"05 Sep",lbl:"Assignment 2 Due — CS401 all sections",type:"asgn",year:"2nd Year"},
    {date:"15 Sep",lbl:"Quiz 3 — CS401 all sections",type:"quiz",year:"2nd Year"},
    {date:"20 Oct",lbl:"Attendance Finalisation Deadline — All Years",type:"att",year:"All"},
    {date:"10 Nov",lbl:"SEE (Finals) begin — All Years",type:"see",year:"All"},
  ];
  const tCol={tt:"#6366f1",quiz:"#f59e0b",asgn:"#10b981",att:"#ec4899",see:"#ef4444"};
  const tLbl={tt:"Term Test",quiz:"Quiz",asgn:"Assignment",att:"Attendance",see:"Finals"};
  return (
    <div style={{padding:"28px 40px",maxWidth:800}}>
      <div style={{...sora,fontWeight:700,fontSize:20,color:T.text,marginBottom:6}}>Academic Calendar</div>
      <div style={{...mono,fontSize:11,color:T.muted,marginBottom:22}}>Odd Semester 2025–26 · All assessment dates across your teaching assignments</div>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        {events.map((ev,i)=>{
          const col=tCol[ev.type];const yc=ev.year==="All"?T.muted:yearColor(ev.year);
          return (
            <div key={i} style={{display:"flex",gap:16,alignItems:"center",padding:"14px 20px",background:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${col}`,borderRadius:i===0?"12px 12px 0 0":i===events.length-1?"0 0 12px 12px":"0",transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.surface2} onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
              <div style={{...mono,fontSize:12,color:T.muted,minWidth:58}}>{ev.date}</div>
              <div style={{flex:1,...sora,fontSize:14,color:T.text}}>{ev.lbl}</div>
              <Chip color={col} size={10}>{tLbl[ev.type]}</Chip>
              <Chip color={yc} size={10}>{ev.year}</Chip>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage() {
  return (
    <div style={{padding:"40px 40px",maxWidth:680}}>
      <div style={{...sora,fontWeight:700,fontSize:20,color:T.text,marginBottom:22}}>My Profile</div>
      <Card>
        <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:22}}>
          <div style={{width:68,height:68,borderRadius:18,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",...sora,fontWeight:800,fontSize:24,color:"#fff"}}>{PROFESSOR.initials}</div>
          <div>
            <div style={{...sora,fontWeight:800,fontSize:20,color:T.text}}>{PROFESSOR.name}</div>
            <div style={{...mono,fontSize:12,color:T.muted,marginTop:2}}>{PROFESSOR.role}</div>
            <div style={{marginTop:6}}><Chip color="#6366f1">{PROFESSOR.id}</Chip></div>
          </div>
        </div>
        <div style={{height:1,background:T.border,margin:"0 -20px 20px"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[{lbl:"Department",val:PROFESSOR.dept},{lbl:"Email",val:PROFESSOR.email},{lbl:"Academic Year",val:"Odd Sem 2025–26"},{lbl:"Total Offerings",val:OFFERINGS.length},{lbl:"Total Students",val:OFFERINGS.reduce((a,o)=>a+o.count,0)},{lbl:"Years Teaching",val:YEAR_GROUPS.length}].map((x,i)=>(
            <div key={i} style={{background:T.surface2,borderRadius:8,padding:"12px 14px"}}>
              <div style={{...mono,fontSize:10,color:T.muted,marginBottom:3}}>{x.lbl}</div>
              <div style={{...sora,fontSize:14,color:T.text,fontWeight:600}}>{x.val}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════ */
const NAV=[{id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"students",icon:"👥",label:"My Students"},{id:"calendar",icon:"📅",label:"Calendar"},{id:"profile",icon:"👤",label:"Profile"}];

export default function App() {
  const [page,setPage]=useState("dashboard");
  const [offering,setOffering]=useState(null);
  const handleOpen=o=>{setOffering(o);setPage("course");};
  const handleBack=()=>{setOffering(null);setPage("dashboard");};
  return (
    <div style={{display:"flex",minHeight:"100vh",background:T.bg,color:T.text}}>
      <style>{GLOBAL_CSS}</style>
      {/* sidebar */}
      <div style={{width:218,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0}}>
        <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🎓</div>
            <div>
              <div style={{...sora,fontWeight:800,fontSize:13,color:T.text}}>MSRUAS</div>
              <div style={{...mono,fontSize:9,color:T.dim,letterSpacing:"0.1em"}}>FACULTY PORTAL</div>
            </div>
          </div>
        </div>
        {/* year stage legend */}
        <div style={{padding:"12px 15px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{...mono,fontSize:9,color:T.dim,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>Year Stages</div>
          {YEAR_GROUPS.map(g=>(
            <div key={g.year} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
              <div style={{width:7,height:7,borderRadius:2,background:g.color,flexShrink:0}}/>
              <span style={{...mono,fontSize:10,color:T.muted,flex:1}}>{g.year}</span>
              <span style={{...mono,fontSize:9,color:g.stageInfo.color}}>{g.stageInfo.label}</span>
            </div>
          ))}
        </div>
        <nav style={{flex:1,padding:"10px 8px"}}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>{setPage(item.id);setOffering(null);}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"none",cursor:"pointer",background:(page===item.id||(page==="course"&&item.id==="dashboard"))?"#6366f118":"transparent",color:(page===item.id||(page==="course"&&item.id==="dashboard"))?"#818cf8":T.muted,...sora,fontWeight:500,fontSize:13,marginBottom:2,transition:"all 0.15s",textAlign:"left"}}>
              <span style={{fontSize:15}}>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div style={{padding:"13px 15px 17px",borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,flexShrink:0,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",...sora,fontWeight:800,fontSize:11,color:"#fff"}}>{PROFESSOR.initials}</div>
            <div style={{overflow:"hidden"}}>
              <div style={{...sora,fontWeight:600,fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{PROFESSOR.name}</div>
              <div style={{...mono,fontSize:9,color:T.dim}}>CSE · Assoc. Prof</div>
            </div>
          </div>
        </div>
      </div>
      {/* main */}
      <div style={{flex:1,overflowY:"auto"}}>
        {page==="dashboard"&&<Dashboard onOpen={handleOpen}/>}
        {page==="course"&&offering&&<CourseDetail offering={offering} onBack={handleBack}/>}
        {page==="students"&&<AllStudentsPage/>}
        {page==="calendar"&&<CalendarPage/>}
        {page==="profile"&&<ProfilePage/>}
      </div>
    </div>
  );
}