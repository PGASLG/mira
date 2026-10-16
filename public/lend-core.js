/* Mira lender engine (simulation). Owned by lender.html; dashboard reads summary().
   State: mira_lend_pool = {v:1, offers:[{id,t,exp,fb,left,k}], pieces:[{id,amt,months,rate,start,paid,cover}],
                            app:{acc,F,P,ir}|null, earned, seq}
   - offers: money waiting in the pool (not matched, withdrawable). The lender does not pick a period (the borrower does).
     If nothing is matched by exp (t + WAIT_MONTHS) the rest goes back to cash (fb:"cash") or keeps waiting another window (fb:"keep").
   - pieces: <= PIECE baht each, matched to a simulated borrower, LOCKED until repaid month by month.
   - app: part of the borrower loan in mira_loan_active (lending.html) funded from the pool; repayments seen there return money.
   mira_topup = investable cash. lend() takes from it; withdraw() and repayments (principal + interest) return to it.
   mira_lend_active is a compatibility mirror for mira-core.js MC.lend(). */
(function(){
  var KEY="mira_lend_pool", RATE=5, BORROW_RATE=7, PIECE=500, PERIODS=[1,3,6,12,24,36], WAIT_MONTHS=3;
  function LS(k,d){ try{ var v=localStorage.getItem(k); return v===null?d:v; }catch(e){ return d; } }
  function SET(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function DEL(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function topup(){ return Math.max(0,+LS("mira_topup","0")||0); }
  function setTop(v){ SET("mira_topup",String(Math.max(0,Math.round(v*100)/100))); }
  function load(){
    var p=null; try{ p=JSON.parse(LS(KEY,"null")); }catch(e){}
    if(!p||p.v!==1){ p={v:1,offers:[],pieces:[],app:null,earned:0,seq:0}; DEL("mira_lend_active"); } // legacy v0 state never took money out of mira_topup
    return p;
  }
  function addMonths(d,n){ var x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
  function monthsBetween(a,b){ a=new Date(a); b=new Date(b); var m=(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth(); if(b.getDate()<a.getDate()) m--; return Math.max(0,m); }
  // same amortised payment as lending.html calc()
  // borrower pays 7%/yr for terms up to 1 year, 10%/yr for terms over 1 year; the lender gets 2 points less, Mira keeps the 2%
  var FEE=2;
  function bR(m){ return m>12?10:7; }                       // borrower rate for a term in months
  function lR(m){ return bR(m)-FEE; }                       // lender rate
  function share(m){ return lR(m)/bR(m); }                  // lender's share of the interest a borrower pays
  var CAP={low:0.5,mid:0.6,high:0.7};
  // f="d": n daily instalments at rate/365 per day; otherwise n monthly instalments at rate/12
  function calc(a,n,rate,f){ var r=(rate==null?lR(f==="d"?12:n):rate)/100/(f==="d"?365:12), pay=a*r/(1-Math.pow(1+r,-n)); return {pay:pay,int:pay*n-a}; }
  function periodsBetween(start,now,f,total){ var m=f==="d"?Math.floor((now-new Date(start).getTime())/864e5):monthsBetween(start,now); return Math.max(0,Math.min(total,m)); }
  function periodStart(start,k,f){ if(f!=="d") return addMonths(start,k).getTime(); var d=new Date(start); d.setDate(d.getDate()+k); return d.getTime(); }
  function daysFor(start,months){ return Math.round((addMonths(start,months).getTime()-new Date(start).getTime())/864e5); }
  function projection(a,n){ var c=calc(a,n); return {principal:a,interest:c.int,total:a+c.int,date:addMonths(new Date(),n),pay:c.pay}; }
  function appLoan(){ try{ var l=JSON.parse(LS("mira_loan_active","null")); return l&&l.amt>0&&l.months>0?l:null; }catch(e){ return null; } }
  // true amortization: balance left after k equal instalments (interest each month = balance x monthly rate)
  function bal(a,n,ratePct,k,f){
    k=Math.min(Math.max(k||0,0),n); if(k>=n) return 0;
    var r=ratePct/100/(f==="d"?365:12); if(!r) return a*(n-k)/n;
    var pay=a*r/(1-Math.pow(1+r,-n)), g=Math.pow(1+r,k);
    return Math.max(0,a*g-pay*(g-1)/r);
  }
  function outP(l){ return bal(l.amt,l.n||l.months,bR(l.months),l.paid||0,l.freq); }
  function waitingOf(p){ return p.offers.reduce(function(s,o){ return s+o.left; },0); }
  function pieceRem(c){ return c.rem!=null?c.rem:bal(c.amt,c.n||c.months,c.rate==null?RATE:c.rate,c.paid,c.freq); }

  function sync(now){
    now=now||Date.now();
    var p=load(), ch=false;
    function credit(pr,int){ setTop(topup()+pr+int); p.earned+=int; ch=true; }
    // 1) match waiting money with simulated borrower demand, piece by piece (every 7th piece is slow to match)
    p.offers.forEach(function(o){
      while(o.left>0.004){
        var tm=o.t+((o.k%7===6)?172800:((o.k*7)%6)*4)*1000;
        if(now<tm) break;
        var size=Math.min(PIECE,o.left); p.seq++;
        var pm=PERIODS[(p.seq*3+1)%PERIODS.length], pf=(p.seq%4===2)?"d":"m", ps=new Date(tm).toISOString();   // simulated borrower picks daily or monthly
        p.pieces.push({id:p.seq,amt:size,months:pm,freq:pf,n:pf==="d"?daysFor(ps,pm):pm,rate:lR(pm),start:ps,paid:0,cover:135+(p.seq*13)%60});
        o.left-=size; o.k++; ch=true;
      }
    });
    // 2) real borrower in this browser (lending.html): fund open demand, then see its repayments
    var loan=appLoan();
    if(p.app&&(!loan||loan.accepted!==p.app.acc)){            // repaid in full (or replaced by a new loan): settle what is left
      credit(p.app.F,p.app.F*p.app.ir); p.app=null;
    } else if(p.app){
      var pn=outP(loan), dP=p.app.P-pn, np=loan.paid||0, dN=np-(p.app.n==null?np:p.app.n);
      if(dP>0.004&&p.app.P>0){
        var sh=p.app.F/p.app.P, pr=sh*dP;
        // lender share of the interest the borrower really paid in these instalments (pay x count - principal repaid)
        var li=p.app.n==null?pr*p.app.ir:sh*Math.max(0,loan.pay*dN-dP)*share(loan.months);
        credit(pr,li); p.app.F-=pr;
      }
      p.app.n=np; p.app.P=pn; p.app.ir=Math.max(0,loan.pay*(loan.n||loan.months)/loan.amt-1)*share(loan.months);
    }
    if(loan){
      var P=outP(loan), demand=P-(p.app&&p.app.acc===loan.accepted?p.app.F:0), take=Math.min(demand,waitingOf(p));
      if(take>=1){
        var need=take; p.offers.forEach(function(o){ var t=Math.min(o.left,need); o.left-=t; need-=t; });
        if(!p.app) p.app={acc:loan.accepted,F:0,P:P,n:loan.paid||0,ir:Math.max(0,loan.pay*(loan.n||loan.months)/loan.amt-1)*share(loan.months)};
        p.app.F+=take; ch=true;
      }
    }
    // nobody borrowed within the waiting window: back to cash, or keep waiting another window (lender's choice)
    p.offers.forEach(function(o){
      if(o.left>0.004&&now>=o.exp){
        if(o.fb==="keep"){ o.exp=addMonths(o.exp,WAIT_MONTHS).getTime(); ch=true; }
        else { setTop(topup()+o.left); o.left=0; ch=true; }
      }
    });
    p.offers=p.offers.filter(function(o){ return o.left>0.004; });
    // 3) simulated borrowers repay one instalment per full month
    p.pieces=p.pieces.filter(function(c){
      var tot=c.n||c.months, m=periodsBetween(c.start,now,c.freq,tot);
      if(m>c.paid){
        var k=calc(c.amt,tot,c.rate,c.freq), n=m-c.paid;
        var prin=bal(c.amt,tot,c.rate,c.paid,c.freq)-bal(c.amt,tot,c.rate,m,c.freq);   // principal part of these instalments
        credit(prin,n*k.pay-prin); c.paid=m;
      }
      return c.paid<tot;
    });
    if(ch) save(p); else mirror(p);
    return p;
  }
  function save(p){ SET(KEY,JSON.stringify(p)); mirror(p); }
  // compatibility mirror for mira-core.js MC.lend(): {amount, months, rate, start, chunks:[{s,d}]}
  function mirror(p){
    var locked=p.pieces.map(function(c){ return {s:pieceRem(c),st:new Date(c.start).getTime(),m:c.months}; });
    var w=waitingOf(p), a=p.app?p.app.F:0;
    if(locked.length+(a>0?1:0)===0&&w<0.004){ DEL("mira_lend_active"); return; }
    var t0=Math.min.apply(null,locked.map(function(x){return x.st;}).concat(p.offers.map(function(o){return o.t;}),[Date.now()]));
    var chunks=locked.map(function(x){ return {s:x.s,d:(x.st-t0)/1000}; });
    if(a>0) chunks.push({s:a,d:0});
    if(w>0.004) chunks.push({s:w,d:9e9});
    var months=Math.max.apply(null,locked.map(function(x){return x.m;}).concat([1]));
    SET("mira_lend_active",JSON.stringify({amount:locked.reduce(function(s,x){return s+x.s;},0)+a+w,months:months,rate:RATE,start:new Date(t0).toISOString(),chunks:chunks}));
  }
  function summaryLocal(){
    var p=sync(), now=Date.now(), locked=0, acc=0;
    p.pieces.forEach(function(c){
      locked+=pieceRem(c);
      // interest accrued in the current (unpaid) month = balance x monthly rate x share of the month elapsed
      var s0=periodStart(c.start,c.paid,c.freq), e0=periodStart(c.start,c.paid+1,c.freq), cr=c.rate==null?RATE:c.rate;
      acc+=bal(c.amt,c.n||c.months,cr,c.paid,c.freq)*cr/100/(c.freq==="d"?365:12)*Math.max(0,Math.min(1,(now-s0)/(e0-s0)));
    });
    if(p.app) locked+=p.app.F;
    var waiting=waitingOf(p);
    return {pool:p,locked:locked,waiting:waiting,earned:p.earned+acc,realized:p.earned,on:locked+waiting>0.004||p.earned>0,cash:topup()};
  }
  function lendLocal(amount,fb){
    amount=Math.floor(amount); if(!(amount>0)||amount>topup()+0.004) return false;
    var p=sync(), now=Date.now(); setTop(topup()-amount);
    p.offers.push({id:now,t:now,exp:addMonths(now,WAIT_MONTHS).getTime(),fb:fb==="keep"?"keep":"cash",left:amount,k:0});
    save(p); return true;
  }
  function withdrawLocal(){
    var p=sync(), w=waitingOf(p); if(w<0.004) return 0;
    p.offers=[]; setTop(topup()+w); save(p); return w;
  }
  // demo only: move every matched piece one month back in time so instalments fall due
  function skipMonth(){
    var p=load(); p.pieces.forEach(function(c){ c.start=addMonths(c.start,-1).toISOString(); }); save(p); sync();
  }
  /* ---- cloud mode: real users matched in Supabase (tables/functions in lending.sql), paper money ----
     Token: the static page runs in a same-origin iframe of the Clerk-protected Next page, so window.parent.Clerk is available.
     No Clerk / no Supabase login / network error => stays on the local simulation above.
     Local pool keeps working next to the cloud one (money already lent locally is never dropped). */
  var R={mode:"starting",cfg:null,me:null,state:null,loans:[],offers:[],why:""};
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function clerk(){ try{ var w=(window.parent&&window.parent!==window)?window.parent:window; return w.Clerk||window.Clerk||null; }catch(e){ return window.Clerk||null; } }
  async function token(){
    var c=clerk(); if(!c||!c.session||typeof c.session.getToken!=="function") return null;
    try{
      var t=await c.session.getToken();
      if(t){ try{ R.me=JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub||null; }catch(e){} }
      return t;
    }catch(e){ return null; }
  }
  async function api(path,opts){
    var t=await token(); if(!t||!R.cfg) throw new Error("no_auth");
    var r=await fetch(R.cfg.url+"/rest/v1/"+path,Object.assign({headers:{apikey:R.cfg.publishable_key,Authorization:"Bearer "+t,"Content-Type":"application/json"}},opts||{}));
    var body=null; try{ body=await r.json(); }catch(e){}
    if(!r.ok){ var err=new Error((body&&(body.message||body.hint))||("http_"+r.status)); err.status=r.status; throw err; }
    return body;
  }
  function rpc(name,args){ return api("rpc/"+name,{method:"POST",body:JSON.stringify(args||{})}); }
  async function refresh(){
    if(R.mode!=="cloud") return;
    try{
      var st=await rpc("lend_state");
      var loans=await api("loans?select=id,lender,principal,months,rate,start,paid,principal_paid,interest_paid,status&status=eq.active&order=start.asc");
      var offers=await api("lend_offers?select=id,left,fallback,expires_at,created_at&order=created_at.asc");
      var C=+st.cash, last=parseFloat(LS("mira_lend_lastc","")); // server cash grew by itself (repayments, expiry): mirror it into mira_topup
      if(isNaN(last)) SET("mira_lend_lastc",String(C));
      else if(C>last+0.004){ setTop(topup()+C-last); SET("mira_lend_lastc",String(C)); }
      else if(C<last-0.004){ SET("mira_lend_lastc",String(C)); }
      R.state=st;
      R.loans=loans.filter(function(l){ return !R.me||l.lender===R.me; });
      R.offers=offers;
    }catch(e){ R.why=String(e.message||e); }
  }
  async function lendCloud(amount,fb){
    var T=topup(); if(amount>T+0.004||amount<1) return false;
    var st=await rpc("lend_state"), C=+st.cash;
    if(T>C+0.004){ var need=Math.ceil(T-C); while(need>0){ var ch=Math.min(need,100000); await rpc("wallet_topup",{amount:ch}); need-=ch; } }
    await rpc("lend",{amount:amount,fallback:fb==="keep"?"keep":"cash"});
    setTop(T-amount);
    var st2=await rpc("lend_state"); SET("mira_lend_lastc",String(+st2.cash));
    await refresh(); return true;
  }
  async function withdrawCloud(){
    var w=+(await rpc("withdraw")); if(w>0) setTop(topup()+w);
    var st=await rpc("lend_state"); SET("mira_lend_lastc",String(+st.cash));
    await refresh(); return w||0;
  }
  function summary(){
    var S=summaryLocal();
    if(R.mode!=="cloud"||!R.state) return S;
    var pool=JSON.parse(JSON.stringify(S.pool));
    R.loans.forEach(function(l,i){ pool.pieces.push({id:i+1,real:true,amt:+l.principal,rem:+l.principal-+l.principal_paid,months:l.months,rate:+l.rate,start:l.start,paid:l.paid}); });
    R.offers.forEach(function(o){ if(+o.left>0.004) pool.offers.push({id:o.id,real:true,left:+o.left,fb:o.fallback,exp:new Date(o.expires_at).getTime(),t:new Date(o.created_at).getTime()}); });
    var locked=S.locked+(+R.state.locked), waiting=S.waiting+(+R.state.waiting), earned=S.earned+(+R.state.earned);
    return {pool:pool,locked:locked,waiting:waiting,earned:earned,realized:S.realized+(+R.state.earned),on:locked+waiting>0.004||earned>0,cash:topup(),mode:"cloud"};
  }
  // most a user may have in lending: 50% / 60% / 70% (low / mid / high risk) of ALL their money (cash + investment port + lending)
  function cap(){
    var S=summary(), lots=[]; try{ lots=JSON.parse(LS("mira_port_lots","[]")); }catch(e){}
    var inv=(Array.isArray(lots)?lots:[]).reduce(function(s,x){ return s+(+x.a||0); },0);
    var used=S.locked+S.waiting, total=topup()+inv+used+S.earned, pct=CAP[LS("mira_risk","mid")]||CAP.mid;
    var limit=Math.floor(total*pct);
    return {pct:pct,total:total,limit:limit,used:used,room:Math.max(0,limit-Math.ceil(used))};
  }
  function lend(amount,fb){
    return R.ready.then(function(){
      if(amount>cap().room+0.004) return false;
      if(R.mode==="cloud") return lendCloud(Math.floor(amount),fb).catch(function(e){ R.why=String(e.message||e); return false; });
      return lendLocal(amount,fb);
    });
  }
  function withdraw(){
    return R.ready.then(async function(){
      var w=withdrawLocal();
      if(R.mode==="cloud"){ try{ w+=await withdrawCloud(); }catch(e){ R.why=String(e.message||e); } }
      return w;
    });
  }
  R.ready=(async function(){
    try{ R.cfg=await (await fetch("supabase-config.json",{cache:"no-store"})).json(); }catch(e){}
    for(var i=0;i<6&&R.mode==="starting"&&R.cfg;i++){
      var t=await token();
      if(t){ try{ await rpc("lend_state"); R.mode="cloud"; }catch(e){ R.why=String(e.message||e); R.mode="local"; } break; }
      await sleep(500);
    }
    if(R.mode==="starting") R.mode="local";
    if(R.mode==="cloud"){ await refresh(); setInterval(refresh,4000); }
  })();
  /* ---- borrower side (used by lending.html in cloud mode; selects only, so it works with the base schema) ---- */
  async function borrowerLoans(){
    var rows=await api("loans?select=id,borrower,principal,months,rate,start,paid,principal_paid,status&status=eq.active&order=start.asc");
    return rows.filter(function(l){ return !R.me||l.borrower===R.me; });
  }
  async function borrow(amount,months){
    if(R.mode!=="cloud") return {ok:false,local:true};
    try{ await rpc("request_loan",{amount:Math.floor(amount),months:months}); await refresh(); return {ok:true}; }
    catch(e){ R.why=String(e.message||e); return {ok:false,err:R.why}; }
  }
  // pay one instalment on every funded piece of the borrower's loan; stops at the first failure
  async function repayMonth(){
    if(R.mode!=="cloud") return {ok:true,local:true,paid:0};
    var paid=0;
    try{
      var ls=await borrowerLoans();
      var lo=Math.min.apply(null,ls.map(function(l){ return l.paid; }));   // a retry after a partial failure only pays the pieces still behind
      for(var i=0;i<ls.length;i++){ if(ls[i].paid===lo) paid+=+(await rpc("repay",{loan_id:ls[i].id})); }
      setTop(Math.max(0,topup()-paid));
      var st=await rpc("lend_state"); SET("mira_lend_lastc",String(+st.cash));
      await refresh(); return {ok:true,paid:paid};
    }catch(e){
      if(paid>0) setTop(Math.max(0,topup()-paid));
      R.why=String(e.message||e); return {ok:false,paid:paid,err:R.why};
    }
  }
  async function repayAll(){
    if(R.mode!=="cloud") return {ok:true,local:true,paid:0};
    var paid=0;
    try{
      var ls=await borrowerLoans();
      for(var i=0;i<ls.length;i++){ for(var k=ls[i].paid;k<ls[i].months;k++){ paid+=+(await rpc("repay",{loan_id:ls[i].id})); } }
      setTop(Math.max(0,topup()-paid));
      var st=await rpc("lend_state"); SET("mira_lend_lastc",String(+st.cash));
      try{ var open=await api("borrow_requests?select=id,left&left=gt.0"); for(var j=0;j<open.length;j++){ await rpc("cancel_request",{request_id:open[j].id}); } }catch(e){ /* cancel_request not installed yet: leave open demand */ }
      await refresh(); return {ok:true,paid:paid};
    }catch(e){
      if(paid>0) setTop(Math.max(0,topup()-paid));
      R.why=String(e.message||e); return {ok:false,paid:paid,err:R.why};
    }
  }
  function mode(){ return R.mode; }
  window.MiraLend={borrow:borrow,repayMonth:repayMonth,repayAll:repayAll,borrowerLoans:borrowerLoans,mode:mode,why:function(){ return R.why; },ready:R.ready,refresh:refresh,RATE:RATE,BORROW_RATE:BORROW_RATE,bR:bR,lR:lR,FEE:FEE,cap:cap,PIECE:PIECE,PERIODS:PERIODS,WAIT_MONTHS:WAIT_MONTHS,sync:sync,summary:summary,lend:lend,withdraw:withdraw,skipMonth:skipMonth,projection:projection,calc:calc,addMonths:addMonths,topup:topup,pieceRem:pieceRem};
})();
