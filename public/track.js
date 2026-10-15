/* track.html logic: one track's value, real holdings (S&P 500 index + the model's core funds), facts. */
const {P,ST,RK,store,holdings,mixFor,mixIndex,stats,trackValue}=MC;
const T_=new URLSearchParams(location.search).get("t")==="high"?"high":"low";
const COL={cash:"#c9c5b8",stocks:"#1457d9",bonds:"#5f6675",commodities:"#f2b01e",crypto:"#7a5cc0",currencies:"#8aa4d6","real estate":"#a89f86"};
const NAME={
 SPX:{th:"ดัชนี S&P 500 · หุ้น 500 บริษัทใหญ่ของสหรัฐฯ",en:"S&P 500 index · 500 large US companies"},
 SHY:{th:"พันธบัตรรัฐบาลสหรัฐฯ อายุ 1–3 ปี",en:"US Treasuries, 1–3 years"},
 HYG:{th:"พันธบัตรบริษัทดอกเบี้ยสูง",en:"US high-yield corporate bonds"},
 EMB:{th:"พันธบัตรประเทศกำลังพัฒนา",en:"Emerging-market bonds"},
 GLD:{th:"ทองคำ",en:"Gold"}, SLV:{th:"เงิน (โลหะ)",en:"Silver"},
 DBC:{th:"สินค้าโภคภัณฑ์รวม (น้ำมัน โลหะ ฯลฯ)",en:"Broad commodities (oil, metals, …)"},
 DBA:{th:"สินค้าเกษตร (ข้าวสาลี ข้าวโพด ฯลฯ)",en:"Agriculture (wheat, corn, …)"},
 UUP:{th:"ค่าเงินดอลลาร์สหรัฐ",en:"US dollar"}, VNQ:{th:"อสังหาริมทรัพย์สหรัฐฯ",en:"US real estate"},
 CASH:{th:"เงินสด / ฝากสั้นๆ",en:"Cash / short deposit"}};
const I18N={
 th:{back:"← กลับ", trk:{low:"แทร็กเสี่ยงต่ำ",high:"แทร็กเสี่ยงสูง"},
  sub:{low:"เน้นของที่ขึ้นลงน้อย มีหุ้นส่วนน้อย",high:"มีหุ้นมากขึ้น กำไรอาจมากกว่า แต่ขึ้นลงแรงกว่า"},
  v_l:"เงินในแทร็กนี้ตอนนี้ (รวมกำไร)", up:"กำไร", down:"ขาดทุน", c1l:"เงินที่ใส่", c2l:"สัดส่วนของเงินทั้งหมด", c3l:"หุ้น",
  empty:"เริ่มต้นที่ ฿0 · เติมเงินเพื่อเริ่มลงทุน (จำลอง)",
  bt:(v,d)=>`ผลย้อนหลัง (ไม่ใช่เงินของคุณ): ถ้าใส่ ฿10,000 ในแทร็กนี้ตั้งแต่ ${d} จะเป็นประมาณ ฿${v}`,
  h_in:"ข้างในมีอะไรบ้าง", s_in:"แตะที่แต่ละสี เพื่อดูประเภทของสิ่งที่ถืออยู่", dn_l:"แทร็กนี้",
  h_h:"ถืออะไรอยู่จริงๆ", s_h:"รายการที่โมเดลของ Mira ถือในแทร็กนี้ (พอร์ตจำลอง) เรียงจากมากไปน้อย",
  th_n:"สินทรัพย์", th_w:"สัดส่วน", th_a:"จำนวนเงิน",
  spx:"ส่วนที่เป็นหุ้นคือดัชนี S&P 500 ถือผ่านกองทุนดัชนี รวมบริษัทใหญ่ของสหรัฐฯ เช่น Apple, Microsoft, Nvidia ไม่ได้เลือกหุ้นรายตัว จึงกระจายความเสี่ยงอยู่แล้ว",
  how:"วิธีจัดการ: โมเดลวัดความผันผวนของตลาดทุกเดือน ถ้าตลาดแกว่งแรงจะลดส่วนหุ้นแล้วย้ายไปส่วนที่นิ่งกว่า ถ้านิ่งก็กลับมาถือเต็มตามแผน",
  what:{cash:"เงินที่ถือไว้ใกล้ตัว ขึ้นลงน้อยมาก ไว้รับมือช่วงตลาดผันผวน",stocks:"ส่วนเล็กๆ ของบริษัท ถ้าบริษัทโต เงินก็โตตาม แต่ขึ้นลงค่อนข้างแรง",bonds:"ให้รัฐหรือบริษัทยืมเงิน แล้วได้ดอกเบี้ย ขึ้นลงน้อยกว่าหุ้น",commodities:"ของจริงที่คนซื้อขายกัน เช่น ทอง น้ำมัน ข้าวสาลี",crypto:"เงินดิจิทัล ขึ้นลงแรงมาก",currencies:"ค่าเงินดอลลาร์เทียบกับเงินสกุลอื่น","real estate":"กองทุนที่ลงทุนในอสังหาริมทรัพย์ ได้ค่าเช่าและราคาปรับตามตลาด"},
  kinds:{cash:"เงินสด / ฝากสั้นๆ",stocks:"หุ้น",bonds:"พันธบัตร",commodities:"ของจริง (ทอง น้ำมัน ข้าว)",crypto:"คริปโต",currencies:"ค่าเงิน","real estate":"อสังหาริมทรัพย์"},
  h_f:"ควรรู้ก่อนตัดสินใจ",
  h_ld:"อยากให้เงินทำงานต่างออกไป?", s_ld:"ปล่อยเงินให้คนอื่นยืม รับเงินคืนพร้อมดอกเบี้ยเมื่อเขาผ่อนครบ ถอนส่วนที่ยังไม่มีคนยืมได้ทุกเมื่อ", ld_b:"ปล่อยเงิน ›",
  k1:(v)=>`<b>ปกติเงินขึ้นลงประมาณ ${v}% ต่อปี</b>เงิน ฿100 อาจเป็น ฿${100-v}–฿${100+v} ภายใน 1 ปี`,
  k2:(d)=>`<b>ช่วงที่แย่สุดที่เคยเจอ</b>เงิน ฿100 เคยลดเหลือ ฿${100-d} ก่อนค่อยๆ กลับมา`,
  k3:(w)=>`<b>เดือนที่แย่ (ประมาณ 1 ใน 20 เดือน)</b>เงิน ฿100 ในแทร็กนี้อาจเหลือประมาณ ฿${w} ในเดือนนั้น (นับเฉพาะส่วนหุ้น)`,
  cut:(b,n)=>`ตอนนี้ตลาดผันผวน โมเดลลดส่วนหุ้นจาก ${b}% เหลือ ${n}%`,
  k_note:"สัดส่วนมาจากโมเดลวิจัยของ Mira ไม่ใช่คำแนะนำเฉพาะตัว ตัวเลขความเสี่ยงคำนวณจากข้อมูลย้อนหลัง",
  j1:"คุยกับ June AI เพื่อปรับแผน", j2:"หน้านี้ดูอย่างเดียว ให้ June ช่วยเปลี่ยนแทร็กนี้ให้คุณ",
  fine:"เพื่อการวิจัยเท่านั้น ไม่ใช่คำแนะนำการลงทุน ผลในอดีตไม่รับประกันอนาคต พอร์ตนี้เป็นพอร์ตจำลอง ไม่ใช่เงินจริง"},
 en:{back:"← Back", trk:{low:"Low-Risk Track",high:"High-Risk Track"},
  sub:{low:"Mostly things that move less. A small share of stocks.",high:"More stocks. Could grow more, but moves a lot more."},
  v_l:"Money in this track now (profit included)", up:"profit", down:"loss", c1l:"Put in", c2l:"Share of your money", c3l:"Stocks",
  empty:"Starting at ฿0 · add money to begin (paper)",
  bt:(v,d)=>`Backtest (not your money): ฿10,000 in this track since ${d} would be about ฿${v}`,
  h_in:"What is inside", s_in:"Tap a colour to see the type of thing it holds.", dn_l:"This track",
  h_h:"What it really holds", s_h:"The positions Mira's model holds in this track (paper portfolio), largest first.",
  th_n:"Asset", th_w:"Share", th_a:"Amount",
  spx:"The stock part is the S&P 500 index, held through an index fund. It covers large US companies such as Apple, Microsoft and Nvidia. There is no single-stock picking, so it is already spread out.",
  how:"How it is managed: each month the model measures how bumpy the market is. When it is jumpy it cuts stocks and moves to calmer holdings; when calm it goes back to the full plan.",
  what:{cash:"Money kept close at hand. It barely moves and cushions the bumpy times.",stocks:"Small pieces of companies. They grow with the company but move a lot.",bonds:"You lend to a government or company and earn interest. Moves less than stocks.",commodities:"Real things people trade, like gold, oil and wheat.",crypto:"Digital money. Moves up and down a lot.",currencies:"The US dollar against other currencies.","real estate":"Funds that invest in property and earn rent."},
  kinds:{cash:"Cash / short deposit",stocks:"Stocks",bonds:"Bonds",commodities:"Real goods (gold, oil, grain)",crypto:"Crypto",currencies:"Currency","real estate":"Property"},
  h_f:"Good to know",
  h_ld:"Want your money to work differently?", s_ld:"Lend it to others and get it back with interest when they finish repaying. Pull back the part nobody has borrowed any time.", ld_b:"Lend money ›",
  k1:(v)=>`<b>Usually moves about ${v}% a year.</b>฿100 could be ฿${100-v}–฿${100+v} in a year.`,
  k2:(d)=>`<b>The worst time so far:</b>฿100 once dropped to ฿${100-d} before slowly coming back.`,
  k3:(w)=>`<b>A bad month (about 1 in 20):</b>฿100 in this track could drop to about ฿${w} in that month (stock part only).`,
  cut:(b,n)=>`The market is bumpy now, so the model cut stocks from ${b}% to ${n}%.`,
  k_note:"Shares come from Mira's research model. Not personal advice. Risk numbers are based on past data.",
  j1:"Talk to June AI to adjust the plan", j2:"This page is view-only. Let June change this track for you.",
  fine:"Research only, not investment advice. Past results do not guarantee the future. This is a paper portfolio, not real money."}
};
let lang=store.get("mira_lang","th");
const sp=store.get("mira_split"), rk=store.get("mira_risk");
const split=sp!==null&&!isNaN(+sp)?+sp:({low:10,mid:30,high:60}[rk]||30);
const frac=T_==="high"?split/100:1-split/100;
const $=id=>document.getElementById(id), fmt=n=>Math.round(n).toLocaleString("en-US");
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let openKind=null;
function render(){
  const T=I18N[lang], H=holdings(T_), w=mixFor(T_), tv=trackValue(T_,frac), idx=tv.idx, s=stats(idx);
  const g=tv.value-tv.put, pc=tv.put?g/tv.put*100:0;
  document.documentElement.lang=lang; document.title="Mira — "+T.trk[T_];
  $("lang").textContent=lang==="th"?"EN":"ไทย"; $("back").textContent=T.back;
  $("title").innerHTML=`<span class="dot" style="background:${T_==="low"?"var(--green)":"var(--yellow)"}"></span>`+esc(T.trk[T_]); $("sub").textContent=T.sub[T_];
  $("v_l").textContent=T.v_l; $("v").textContent="฿"+fmt(tv.value);
  $("v_p").className=g>=0?"up":"down"; $("v_p").textContent=tv.put?(g>=0?"+":"-")+"฿"+fmt(Math.abs(g))+" ("+(g>=0?"+":"-")+Math.abs(pc).toFixed(1)+"% "+(g>=0?T.up:T.down)+")":T.empty;
  $("bt").textContent=T.bt(fmt(tv.bt*10000),P.curve[0][0]);
  $("c1l").textContent=T.c1l; $("c1").textContent="฿"+fmt(tv.put); $("c2l").textContent=T.c2l; $("c2").textContent=Math.round(frac*100)+"%"; $("c3l").textContent=T.c3l; $("c3").textContent=Math.round(w.stocks||0)+"%";
  // real holdings table
  $("h_h").textContent=T.h_h; $("s_h").textContent=T.s_h;
  $("hold").innerHTML=`<div class="hr hh"><span>${T.th_n}</span><span>${T.th_w}</span><span>${T.th_a}</span></div>`+H.map(h=>{
    const nm=(NAME[h.sym]||{})[lang]||T.kinds[h.kind]||h.kind;
    return `<div class="hr"><span><i style="background:${COL[h.kind]}"></i><b>${esc(h.sym||"")}</b> ${esc(nm)}</span><span>${h.pct.toFixed(1)}%</span><span>฿${fmt(tv.value*h.pct/100)}</span></div>`; }).join("");
  $("spx").textContent=T.spx; $("how").textContent=T.how;
  // donut by type
  $("h_in").textContent=T.h_in; $("s_in").textContent=T.s_in; $("dn_l").textContent=T.dn_l; $("dn_v").textContent="฿"+fmt(tv.value);
  const kinds=Object.keys(w).filter(k=>w[k]>0), tot=kinds.reduce((a,k)=>a+w[k],0), R=15.9155; let off=0;
  $("donut").innerHTML=`<circle cx="21" cy="21" r="${R}" fill="none" stroke="var(--sky)" stroke-width="6"/>`+kinds.map(k=>{const p=w[k]/tot*100,seg=`<circle cx="21" cy="21" r="${R}" fill="none" stroke="${COL[k]}" stroke-width="${openKind===k?7.5:6}" stroke-dasharray="${(p-.6).toFixed(2)} ${(100-p+.6).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" data-k="${k}" style="cursor:pointer"/>`;off+=p;return seg;}).join("");
  $("leg").innerHTML=kinds.map(k=>{const p=w[k]/tot*100;return`<button data-k="${k}" class="${openKind===k?"on":""}"><i style="background:${COL[k]}"></i><span>${esc(T.kinds[k]||k)}</span><span class="p">${Math.round(p)}%</span><span class="a">฿${fmt(tv.value*p/100)}</span></button>`}).join("");
  const wb=$("what");
  if(openKind&&w[openKind]>0){ wb.hidden=false; wb.innerHTML=`<b>${esc(T.kinds[openKind])}</b><br>${esc(T.what[openKind]||"")}`; } else wb.hidden=true;
  $("h_f").textContent=T.h_f; $("k1").innerHTML=T.k1(Math.round(s.vol)); $("k2").innerHTML=T.k2(Math.round(s.dd));
  const hasW=ST&&typeof ST.worst_month_95_pct==="number"; $("k3w").hidden=!hasW;
  if(hasW) $("k3").innerHTML=T.k3(Math.round(100-(w.stocks||0)/100*ST.worst_month_95_pct));
  const sh=ST&&ST.stock_share_by_base&&ST.stock_share_by_base[RK[T_]], bs=+RK[T_], kc=$("k_cut");
  if(typeof sh==="number"&&sh*100<bs-.5){ kc.hidden=false; kc.textContent=T.cut(bs,Math.round(sh*100)); } else kc.hidden=true;
  $("h_ld").textContent=T.h_ld; $("s_ld").textContent=T.s_ld; $("ld_b").textContent=T.ld_b;
  $("k_note").textContent=T.k_note; $("j1").textContent=T.j1; $("j2").textContent=T.j2; $("fine").textContent=T.fine;
}
document.addEventListener("click",e=>{const c=e.target.closest("[data-k]");if(c){openKind=openKind===c.dataset.k?null:c.dataset.k;render();}});
$("june").onclick=()=>{location.href="june.html?track="+T_};
$("lang").onclick=()=>{lang=lang==="th"?"en":"th";store.set("mira_lang",lang);render();};
render();
