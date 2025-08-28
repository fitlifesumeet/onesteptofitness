
import React, { useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const round = (n,d=0)=>{ const p=Math.pow(10,d); return Math.round(n*p)/p; };
const activityFactors = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very:1.9 };
const mifflin = ({ sex, weightKg, heightCm, age })=>{ const base = 10*weightKg + 6.25*heightCm - 5*age; return sex==='male'? base+5 : base-161; };
const adjustCalories = (tdee, goal)=> goal==='fat_loss'? tdee*0.8 : goal==='muscle_gain'? tdee*1.15 : goal==='endurance'? tdee*1.05 : tdee;
const macrosFromCal = (cal, weightKg, goal, proteinPref)=>{ const proteinPerKg = goal==='muscle_gain'?2.0:goal==='fat_loss'?1.8:1.6; const proteinG = proteinPerKg*weightKg; const fatKcal = goal==='endurance'?cal*0.20:cal*0.25; const fatG = fatKcal/9; const carbKcal = Math.max(cal - proteinG*4 - fatKcal, 0); const carbsG = carbKcal/4; const proteinNote = proteinPref==='plant'?'Prioritize tofu, tempeh, legumes, seitan.':proteinPref==='animal'?'Lean poultry, fish, eggs, dairy.':'Mix plant and animal proteins.'; return { proteinG, carbsG, fatG, proteinNote }; };

// Diet types: includes 'indian_vegetarian' as requested
const DIET_TYPES = ['balanced','high_protein','keto','vegetarian','vegan','indian_vegetarian'];

// RECIPES: added Indian Vegetarian & Indian Vegan options (tagged 'indian' and 'indian_vegetarian')
const RECIPES = [
  // Global / Western-style
  { id:'r-oats-greek', name:'Protein Overnight Oats', diet:['balanced','high_protein','vegetarian'], kcal:420, protein:35, carbs:50, fat:10, ingredients:['Oats 60g','Greek yogurt 200g','Chia 10g','Berries 100g','Honey 1 tsp'], directions:'Mix in jar, refrigerate overnight.', meal:'breakfast' },
  { id:'r-chicken-rice', name:'Chicken, Rice & Greens', diet:['balanced','high_protein'], kcal:600, protein:45, carbs:65, fat:15, ingredients:['Chicken breast 180g','Basmati rice 1 cup cooked','Broccoli','Olive oil 1 tsp'], directions:'Grill chicken; steam broccoli; plate with rice.', meal:'lunch' },
  { id:'r-tofu-rice', name:'Tofu Stir-fry + Rice', diet:['balanced','vegan','vegetarian'], kcal:520, protein:32, carbs:70, fat:14, ingredients:['Tofu 180g','Brown rice 1 cup cooked','Mixed veg','Soy sauce'], directions:'Pan-fry tofu; add veg & sauce; serve over rice.', meal:'dinner' },
  { id:'r-smoothie', name:'Protein Smoothie', diet:['balanced','high_protein','vegetarian','vegan'], kcal:300, protein:30, carbs:35, fat:5, ingredients:['Protein 1 scoop','Banana','Oats 20g','Water or milk'], directions:'Blend until smooth.', meal:'snack' },

  // Indian Vegetarian (new)
  { id:'r-dal-roti', name:'Dal + Whole Wheat Roti', diet:['indian_vegetarian','vegetarian','vegan'], kcal:520, protein:24, carbs:80, fat:8, ingredients:['Moong dal 1.5 cup','Whole wheat roti x2','Salad'], directions:'Cook dal with turmeric & tomato; serve with rotis and salad.', meal:'lunch' },
  { id:'r-paneer-tikka', name:'Paneer Tikka Bowl', diet:['indian_vegetarian','vegetarian'], kcal:560, protein:38, carbs:55, fat:18, ingredients:['Paneer 150g','Brown rice 1 cup','Peppers','Yogurt marinade'], directions:'Marinate paneer & roast with peppers; serve over rice.', meal:'lunch' },
  { id:'r-poha', name:'Vegetable Poha', diet:['indian_vegetarian','vegetarian','vegan'], kcal:360, protein:10, carbs:60, fat:8, ingredients:['Poha 1.5 cups','Peanuts','Turmeric','Onion','Coriander'], directions:'Rinse poha; temper mustard seeds; toss with veg and peanuts.', meal:'breakfast' },
  { id:'r-upma', name:'Semolina Upma with Veg', diet:['indian_vegetarian','vegetarian','vegan'], kcal:380, protein:12, carbs:62, fat:9, ingredients:['Rava 3/4 cup','Mixed vegetables','Mustard seeds','Lime'], directions:'Roast rava; cook with tempered spices and veg.', meal:'breakfast' },
  { id:'r-chana-rice', name:'Chana Masala + Brown Rice', diet:['indian_vegetarian','vegan'], kcal:520, protein:18, carbs:85, fat:10, ingredients:['Chana 1 cup cooked','Brown rice 1 cup','Onion','Tomato','Spices'], directions:'Cook chana with tomatoes & spices; serve with rice.', meal:'lunch' },
  { id:'r-dosa-coconut', name:'Dosa + Coconut Chutney', diet:['indian_vegetarian','vegetarian','vegan'], kcal:430, protein:8, carbs:70, fat:8, ingredients:['Dosa batter 1 cup','Coconut chutney','Sambar'], directions:'Spread batter thin on pan; serve with chutney & sambar.', meal:'breakfast' },
  { id:'r-roasted-makhana', name:'Roasted Makhana Snack', diet:['indian_vegetarian','vegetarian','vegan'], kcal:120, protein:4, carbs:12, fat:6, ingredients:['Makhana 30g','Salt','Pepper'], directions:'Roast makhana in ghee or oil with spices.', meal:'snack' },
  { id:'r-dhokla', name:'Besan Dhokla', diet:['indian_vegetarian','vegetarian','vegan'], kcal:200, protein:8, carbs:30, fat:6, ingredients:['Besan 1 cup','Yogurt or vegan yogurt','Mustard seeds'], directions:'Prepare batter; steam in tray; temper and serve.', meal:'snack' }
];

function buildWeeklyMeals({ diet, mealsPerDay }){
  const pool = RECIPES.filter(r=> r.diet.includes(diet));
  const slots = mealsPerDay===3? ['breakfast','lunch','dinner'] : ['breakfast','lunch','dinner','snack'];
  const week = [];
  for(let d=0; d<7; d++){
    const day = [];
    slots.forEach((slot,i)=>{
      const arr = pool.filter(r=> r.meal===slot);
      day.push(arr.length? arr[(d+i)%arr.length] : RECIPES[(d+i)%RECIPES.length]);
    });
    week.push(day);
  }
  return week;
}

export default function Planner(){
  const [form, setForm] = useState({ name:'', age:30, sex:'male', heightCm:175, weightKg:75, activity:'moderate', goal:'muscle_gain', dietType:'indian_vegetarian', mealsPerDay:4 });
  const bmr = useMemo(()=> mifflin({ sex:form.sex, weightKg:form.weightKg, heightCm:form.heightCm, age:form.age }), [form]);
  const tdee = useMemo(()=> bmr * (activityFactors[form.activity]||1.55), [bmr, form.activity]);
  const calories = useMemo(()=> adjustCalories(tdee, form.goal), [tdee, form.goal]);
  const macros = useMemo(()=> macrosFromCal(calories, form.weightKg, form.goal, 'mixed'), [calories, form.weightKg, form.goal]);
  const weeklyMeals = useMemo(()=> buildWeeklyMeals({ diet: form.dietType, mealsPerDay: form.mealsPerDay }), [form.dietType, form.mealsPerDay]);
  const ref = useRef(null);

  const CHART_COLORS = ['#4F46E5','#06B6D4','#F97316','#10B981','#EF4444'];
  const macroData = [{ name:'Protein', value: Math.round(macros.proteinG) }, { name:'Carbs', value: Math.round(macros.carbsG) }, { name:'Fat', value: Math.round(macros.fatG) }];

  const exportJSON = ()=>{ const data={ user:form, metrics:{ bmr:Math.round(bmr), tdee:Math.round(tdee), calories:Math.round(calories), macros }, meals:weeklyMeals }; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`plan_${form.name||'user'}.json`; a.click(); URL.revokeObjectURL(url); };
  const exportPDF = async ()=>{ if(!ref.current) return; const canvas = await html2canvas(ref.current,{scale:2}); const img = canvas.toDataURL('image/png'); const pdf = new jsPDF({ unit:'pt', format:'a4' }); const pw = pdf.internal.pageSize.getWidth(); const iw = pw - 40; const ih = canvas.height * (iw/canvas.width); pdf.addImage(img,'PNG',20,20,iw,ih); pdf.save(`plan_${form.name||'user'}.pdf`); };

  return (
    <div style={{padding:20}} ref={ref}>
      <h1 style={{marginBottom:12}}>Fitness & Nutrition Planner — Indian Vegetarian included</h1>
      <div style={{display:'flex',gap:20}}>
        <div style={{flex:1}}>
          <h3>Inputs</h3>
          <label style={{display:'block'}}>Name<input style={{width:'100%'}} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></label>
          <label style={{display:'block'}}>Age<input type="number" style={{width:'100%'}} value={form.age} onChange={e=>setForm({...form,age:Number(e.target.value)})} /></label>
          <label style={{display:'block'}}>Height (cm)<input type="number" style={{width:'100%'}} value={form.heightCm} onChange={e=>setForm({...form,heightCm:Number(e.target.value)})} /></label>
          <label style={{display:'block'}}>Weight (kg)<input type="number" style={{width:'100%'}} value={form.weightKg} onChange={e=>setForm({...form,weightKg:Number(e.target.value)})} /></label>
          <label style={{display:'block'}}>Diet<select style={{width:'100%'}} value={form.dietType} onChange={e=>setForm({...form,dietType:e.target.value})}><option value="balanced">Balanced</option><option value="high_protein">High Protein</option><option value="keto">Keto</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="indian_vegetarian">Indian Vegetarian</option></select></label>
          <div style={{marginTop:8}}><button onClick={exportJSON} style={{marginRight:8}}>Export JSON</button><button onClick={exportPDF}>Export PDF</button></div>
        </div>
        <div style={{flex:2}}>
          <h3>Targets</h3>
          <div>BMR: {Math.round(bmr)} kcal</div>
          <div>TDEE: {Math.round(tdee)} kcal</div>
          <div>Calories: {Math.round(calories)} kcal</div>
          <div style={{height:240}}>
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={macroData} dataKey="value" nameKey="name" outerRadius={90} label>{macroData.map((_,i)=>(<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}</Pie><ReTooltip/></PieChart></ResponsiveContainer>
          </div>
          <div style={{height:200, marginTop:12}}>
            <ResponsiveContainer width="100%" height="100%"><BarChart data={macroData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><ReTooltip/><Bar dataKey="value">{macroData.map((_,i)=>(<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}</Bar></BarChart></ResponsiveContainer>
          </div>

          <h3 style={{marginTop:12}}>Weekly Meals (sample)</h3>
          {weeklyMeals.map((day,i)=>(<div key={i} style={{border:'1px solid #eee',padding:8,marginBottom:8}}><strong>Day {i+1}</strong><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:6}}>{day.map((r,idx)=>(<div key={idx} style={{border:'1px solid #f0f0f0',padding:8}}><div style={{fontWeight:600}}>{r.meal} • {r.name}</div><div style={{fontSize:12,color:'#666'}}>{r.kcal} kcal • {r.protein}P / {r.carbs || '—'}C / {r.fat || '—'}F</div><div style={{fontSize:13,marginTop:6}}>{r.ingredients? r.ingredients.join(', ') : ''}</div></div>))}</div></div>))}
        </div>
      </div>
    </div>
  );
}
