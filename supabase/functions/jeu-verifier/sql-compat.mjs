const SQLX=(()=>{
  const isNull=v=>v===null||v===undefined;
  const str=v=>isNull(v)?null:(typeof Uint8Array!=='undefined'&&v instanceof Uint8Array?Array.from(v,c=>String.fromCharCode(c)).join(''):String(v));
  const num=v=>{if(isNull(v)||v==='')return null;const n=typeof v==='number'?v:Number(v);return isNaN(n)?null:n;};
  const pad=(n,w=2)=>String(Math.abs(Math.trunc(n))).padStart(w,'0');
  const chars=s=>Array.from(s);
  const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  /* Une date telle que SQLite l’enregistre : 'AAAA-MM-JJ', avec ou sans heure ('AAAA-MM-JJ HH:MM:SS'). */
  function sqlDate(v){
    if(isNull(v)||v==='')return null;
    const m=String(v).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/);
    if(!m)return null;
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0)));
    if(d.getUTCMonth()!==+m[2]-1||d.getUTCDate()!==+m[3])return null;   // 2026-02-31 n’existe pas
    return {d,time:!!m[4]};
  }
  const ymd=d=>`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  const hms=d=>`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const out=(d,time)=>d?(time?ymd(d)+' '+hms(d):ymd(d)):null;
  /* L’heure de l’appareil, écrite comme une date SQLite */
  function nowLocal(){const n=new Date();return new Date(Date.UTC(n.getFullYear(),n.getMonth(),n.getDate(),n.getHours(),n.getMinutes(),n.getSeconds()));}
  const dayNum=d=>Math.floor(d.getTime()/864e5);
  const doy=d=>dayNum(d)-dayNum(new Date(Date.UTC(d.getUTCFullYear(),0,1)))+1;
  function isoWeek(d){
    const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
    t.setUTCDate(t.getUTCDate()+3-((t.getUTCDay()+6)%7));
    return 1+Math.floor((dayNum(t)-dayNum(new Date(Date.UTC(t.getUTCFullYear(),0,1))))/7);
  }
  function addMonths(d,n){
    const y=d.getUTCFullYear(),m=d.getUTCMonth()+n,last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    return new Date(Date.UTC(y,m,Math.min(d.getUTCDate(),last),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));
  }
  const lastDay=d=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));
  const UNITS={year:'year',years:'year',yy:'year',yyyy:'year',quarter:'quarter',qq:'quarter',q:'quarter',month:'month',months:'month',mm:'month',m:'month',
    week:'week',weeks:'week',wk:'week',ww:'week',isoweek:'week',day:'day',days:'day',dd:'day',d:'day',dayofyear:'doy',doy:'doy',dy:'doy',y:'doy',
    hour:'hour',hours:'hour',hh:'hour',minute:'minute',minutes:'minute',mi:'minute',n:'minute',second:'second',seconds:'second',ss:'second',s:'second',
    dow:'dow',weekday:'dow',dw:'dow',isodow:'isodow'};
  const unit=u=>UNITS[String(u==null?'':u).trim().toLowerCase()]||null;
  function part(u,d){
    switch(unit(u)){
      case 'year':return d.getUTCFullYear(); case 'quarter':return Math.ceil((d.getUTCMonth()+1)/3); case 'month':return d.getUTCMonth()+1;
      case 'week':return isoWeek(d); case 'day':return d.getUTCDate(); case 'doy':return doy(d);
      case 'hour':return d.getUTCHours(); case 'minute':return d.getUTCMinutes(); case 'second':return d.getUTCSeconds();
      case 'dow':return d.getUTCDay(); case 'isodow':return d.getUTCDay()||7;
    }
    if(/^epoch$/i.test(String(u).trim()))return Math.floor(d.getTime()/1000);   // EXTRACT(EPOCH FROM …) : les secondes depuis le 1er janvier 1970
    return null;
  }
  function add(u,n,d){
    n=num(n); if(n===null)return null;
    switch(unit(u)){
      case 'year':return addMonths(d,12*n); case 'quarter':return addMonths(d,3*n); case 'month':return addMonths(d,n);
      case 'week':return new Date(d.getTime()+7*n*864e5); case 'day':case 'doy':case 'dow':case 'isodow':return new Date(d.getTime()+n*864e5);
      case 'hour':return new Date(d.getTime()+n*36e5); case 'minute':return new Date(d.getTime()+n*6e4); case 'second':return new Date(d.getTime()+n*1e3);
    }
    return null;
  }
  /* DATEDIFF à la SQL Server : nombre de frontières (années, mois, jours…) franchies entre deux dates. */
  function diff(u,a,b){
    switch(unit(u)){
      case 'year':return b.getUTCFullYear()-a.getUTCFullYear();
      case 'quarter':return (b.getUTCFullYear()*4+Math.floor(b.getUTCMonth()/3))-(a.getUTCFullYear()*4+Math.floor(a.getUTCMonth()/3));
      case 'month':return (b.getUTCFullYear()*12+b.getUTCMonth())-(a.getUTCFullYear()*12+a.getUTCMonth());
      case 'week':return Math.floor((dayNum(b)+4)/7)-Math.floor((dayNum(a)+4)/7);
      case 'day':case 'doy':case 'dow':case 'isodow':return dayNum(b)-dayNum(a);
      case 'hour':return Math.floor(b.getTime()/36e5)-Math.floor(a.getTime()/36e5);
      case 'minute':return Math.floor(b.getTime()/6e4)-Math.floor(a.getTime()/6e4);
      case 'second':return Math.floor(b.getTime()/1e3)-Math.floor(a.getTime()/1e3);
    }
    return null;
  }
  /* DATE_FORMAT de MySQL : %d/%m/%Y, %H:%i… (noms des jours et des mois en anglais, comme MySQL par défaut). */
  function fmtMysql(d,f){
    return String(f).replace(/%([a-zA-Z%])/g,(m,c)=>{
      const H=d.getUTCHours(),h12=H%12||12;
      switch(c){
        case 'Y':return String(d.getUTCFullYear()); case 'y':return pad(d.getUTCFullYear()%100);
        case 'm':return pad(d.getUTCMonth()+1); case 'c':return String(d.getUTCMonth()+1);
        case 'd':return pad(d.getUTCDate()); case 'e':return String(d.getUTCDate());
        case 'H':return pad(H); case 'k':return String(H); case 'h':case 'I':return pad(h12); case 'l':return String(h12);
        case 'i':return pad(d.getUTCMinutes()); case 's':case 'S':return pad(d.getUTCSeconds()); case 'p':return H<12?'AM':'PM';
        case 'T':return hms(d); case 'r':return `${pad(h12)}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${H<12?'AM':'PM'}`;
        case 'M':return MONTHS[d.getUTCMonth()]; case 'b':return MONTHS[d.getUTCMonth()].slice(0,3);
        case 'W':return DAYS[d.getUTCDay()]; case 'a':return DAYS[d.getUTCDay()].slice(0,3);
        case 'j':return pad(doy(d),3); case 'w':return String(d.getUTCDay()); case 'u':case 'v':return pad(isoWeek(d)); case '%':return '%';
      }
      return c;
    });
  }
  /* TO_CHAR de PostgreSQL et d’Oracle : DD/MM/YYYY, HH24:MI… FM retire les zéros et les espaces de remplissage. */
  const ORA=/"([^"]*)"|FM|YYYY|YY|MONTH|Month|month|MON|Mon|mon|MM|DDD|DD|DAY|Day|day|DY|Dy|dy|HH24|HH12|HH|MI|SS|AM|PM|IW|WW|D|Q/g;
  function fmtOracle(d,f){
    let fm=false;
    return String(f).replace(ORA,(t,lit)=>{
      if(lit!==undefined)return lit;
      if(t==='FM'){fm=!fm;return '';}
      const z=(n,w=2)=>fm?String(n):pad(n,w),nm=s=>fm?s:s.padEnd(9,' '),H=d.getUTCHours(),M=MONTHS[d.getUTCMonth()],J=DAYS[d.getUTCDay()];
      switch(t){
        case 'YYYY':return String(d.getUTCFullYear()); case 'YY':return pad(d.getUTCFullYear()%100);
        case 'MONTH':return nm(M.toUpperCase()); case 'Month':return nm(M); case 'month':return nm(M.toLowerCase());
        case 'MON':return M.slice(0,3).toUpperCase(); case 'Mon':return M.slice(0,3); case 'mon':return M.slice(0,3).toLowerCase();
        case 'MM':return z(d.getUTCMonth()+1); case 'DDD':return z(doy(d),3); case 'DD':return z(d.getUTCDate());
        case 'DAY':return nm(J.toUpperCase()); case 'Day':return nm(J); case 'day':return nm(J.toLowerCase());
        case 'DY':return J.slice(0,3).toUpperCase(); case 'Dy':return J.slice(0,3); case 'dy':return J.slice(0,3).toLowerCase();
        case 'HH24':return z(H); case 'HH12':case 'HH':return z(H%12||12); case 'MI':return z(d.getUTCMinutes()); case 'SS':return z(d.getUTCSeconds());
        case 'AM':case 'PM':return H<12?'AM':'PM'; case 'IW':return z(isoWeek(d)); case 'WW':return z(Math.floor((doy(d)-1)/7)+1);
        case 'D':return String(d.getUTCDay()+1); case 'Q':return String(Math.ceil((d.getUTCMonth()+1)/3));
      }
      return t;
    });
  }
  /* TO_CHAR sur un nombre : autant de décimales que de 9 ou de 0 après le point ; G ou la virgule ajoutent les milliers. */
  function fmtNumber(n,f){
    const body=String(f).replace(/FM/gi,''),dec=(body.split(/[.D]/)[1]||'').replace(/[^09]/g,'').length;
    let s=Math.abs(n).toFixed(dec);
    if(/[G,]/.test(body.split(/[.D]/)[0])){const [i,fr]=s.split('.');s=i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fr!==undefined?'.'+fr:'');}
    return (n<0?'-':'')+s;
  }
  /* Lecture d’une date écrite autrement : TO_DATE(texte, 'DD/MM/YYYY') ou STR_TO_DATE(texte, '%d/%m/%Y'). */
  function parseWith(s,f,mysql){
    s=String(s);f=String(f);
    const reEsc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const MAP=mysql
      ?{Y:['y','(\\d{4})'],y:['y2','(\\d{2})'],m:['m','(\\d{1,2})'],c:['m','(\\d{1,2})'],d:['d','(\\d{1,2})'],e:['d','(\\d{1,2})'],H:['H','(\\d{1,2})'],k:['H','(\\d{1,2})'],
        i:['M','(\\d{2})'],s:['S','(\\d{2})'],S:['S','(\\d{2})'],b:['mon','([A-Za-z]{3})'],M:['mon','([A-Za-z]+)']}
      :{YYYY:['y','(\\d{4})'],YY:['y2','(\\d{2})'],MM:['m','(\\d{1,2})'],DD:['d','(\\d{1,2})'],HH24:['H','(\\d{1,2})'],HH12:['H','(\\d{1,2})'],HH:['H','(\\d{1,2})'],
        MI:['M','(\\d{2})'],SS:['S','(\\d{2})'],MON:['mon','([A-Za-z]{3})'],Mon:['mon','([A-Za-z]{3})'],mon:['mon','([A-Za-z]{3})'],MONTH:['mon','([A-Za-z]+)'],Month:['mon','([A-Za-z]+)'],month:['mon','([A-Za-z]+)']};
    const toks=mysql?/%([a-zA-Z%])/g:/"([^"]*)"|FM|YYYY|YY|MONTH|Month|month|MON|Mon|mon|MM|DD|HH24|HH12|HH|MI|SS/g;
    let re='^\\s*',last=0,m;const keys=[];
    while((m=toks.exec(f))){
      re+=reEsc(f.slice(last,m.index)).replace(/\s+/g,'\\s*');last=toks.lastIndex;
      if(!mysql&&m[1]!==undefined){re+=reEsc(m[1]);continue;}
      const t=mysql?m[1]:m[0];
      if(t==='FM')continue;
      if(mysql&&t==='%'){re+='%';continue;}
      const e=MAP[t];
      if(!e){re+=reEsc(m[0]);continue;}
      re+=e[1];keys.push(e[0]);
    }
    re+=reEsc(f.slice(last)).replace(/\s+/g,'\\s*')+'\\s*$';
    const r=new RegExp(re,'i').exec(s);
    if(!r)return null;
    const v={y:1970,m:1,d:1,H:0,M:0,S:0};let time=false,bad=false;
    keys.forEach((k,i)=>{
      const x=r[i+1];
      if(k==='y')v.y=+x; else if(k==='y2')v.y=2000+(+x);
      else if(k==='mon'){const j=MONTHS.findIndex(n=>n.slice(0,3).toLowerCase()===x.slice(0,3).toLowerCase());if(j<0)bad=true;v.m=j+1;}
      else{v[k]=+x;if('HMS'.includes(k))time=true;}
    });
    if(bad)return null;
    const d=new Date(Date.UTC(v.y,v.m-1,v.d,v.H,v.M,v.S));
    if(d.getUTCMonth()!==v.m-1||d.getUTCDate()!==v.d)return null;
    return {d,time};
  }
  const onDate=fn=>x=>{const p=sqlDate(x);return p?fn(p.d,p.time):null;};
  const truthy=c=>!isNull(c)&&(typeof c==='number'?c!==0:(num(c)!==null&&num(c)!==0));
  const same=(a,b)=>isNull(a)?isNull(b):(!isNull(b)&&(num(a)!==null&&num(b)!==null?num(a)===num(b):String(a)===String(b)));
  const cmp=(a,b)=>num(a)!==null&&num(b)!==null?num(a)-num(b):String(a).localeCompare(String(b));
  const pick=(args,sign)=>{if(!args.length||args.some(isNull))return null;return args.reduce((best,v)=>cmp(v,best)*sign>0?v:best);};
  const rx=(p,flags)=>{try{return new RegExp(String(p),String(flags||'').replace(/[^gimsuy]/g,'').replace('g',''));}catch(e){return null;}};
  function lpad(s,n,p,right){
    if(isNull(s)||isNull(n))return null;
    const a=chars(str(s)),k=Math.max(0,Math.trunc(num(n)));p=isNull(p)?' ':str(p);
    if(a.length>=k)return a.slice(0,k).join('');
    if(!p)return a.join('');
    const fill=chars(p.repeat(Math.ceil((k-a.length)/chars(p).length))).slice(0,k-a.length).join('');
    return right?a.join('')+fill:fill+a.join('');
  }
  function trunc(x,d){
    /* TRUNC d’une date (Oracle) : TRUNC(SYSDATE) → le jour, TRUNC(d, 'MM') → le 1er du mois, 'YYYY' → le 1er janvier, 'Q' → le trimestre. */
    if(typeof x==='string'&&num(x)===null){const p=sqlDate(x);if(!p)return null;const D=p.d,Y=D.getUTCFullYear(),M=D.getUTCMonth();
      const f=isNull(d)||d===undefined?'DD':String(d).toUpperCase();
      if(/^(YYYY|YYY|YY|Y|YEAR|SYYYY)$/.test(f))return ymd(new Date(Date.UTC(Y,0,1)));
      if(/^(Q)$/.test(f))return ymd(new Date(Date.UTC(Y,M-M%3,1)));
      if(/^(MM|MON|MONTH|RM)$/.test(f))return ymd(new Date(Date.UTC(Y,M,1)));
      if(/^(IW)$/.test(f))return ymd(new Date(Date.UTC(Y,M,D.getUTCDate()-((D.getUTCDay()+6)%7))));
      return ymd(new Date(Date.UTC(Y,M,D.getUTCDate())));}
    x=num(x);if(x===null)return null;
    const f=Math.pow(10,num(d)||0);
    return (x<0?Math.ceil(x*f):Math.floor(x*f))/f;
  }
  /* Fonctions à nombre d’arguments fixe */
  const fixed={
    YEAR:onDate(d=>d.getUTCFullYear()),MONTH:onDate(d=>d.getUTCMonth()+1),DAY:onDate(d=>d.getUTCDate()),DAYOFMONTH:onDate(d=>d.getUTCDate()),
    HOUR:onDate(d=>d.getUTCHours()),MINUTE:onDate(d=>d.getUTCMinutes()),SECOND:onDate(d=>d.getUTCSeconds()),QUARTER:onDate(d=>Math.ceil((d.getUTCMonth()+1)/3)),
    DAYOFWEEK:onDate(d=>d.getUTCDay()+1),WEEKDAY:onDate(d=>(d.getUTCDay()+6)%7),DAYOFYEAR:onDate(doy),WEEKOFYEAR:onDate(isoWeek),
    DAYNAME:onDate(d=>DAYS[d.getUTCDay()]),MONTHNAME:onDate(d=>MONTHS[d.getUTCMonth()]),
    NOW:()=>out(nowLocal(),true),GETDATE:()=>out(nowLocal(),true),SYSDATE:()=>out(nowLocal(),true),SYSDATETIME:()=>out(nowLocal(),true),
    CURDATE:()=>ymd(nowLocal()),CURTIME:()=>hms(nowLocal()),
    DATEADD:(u,n,x)=>{const p=sqlDate(x);return p?out(add(u,n,p.d),p.time||['hour','minute','second'].includes(unit(u))):null;},
    ADDDATE:(x,n)=>{const p=sqlDate(x);return p&&num(n)!==null?out(add('day',n,p.d),p.time):null;},
    SUBDATE:(x,n)=>{const p=sqlDate(x);return p&&num(n)!==null?out(add('day',-num(n),p.d),p.time):null;},
    ADD_MONTHS:(x,n)=>{const p=sqlDate(x);if(!p||num(n)===null)return null;const r=p.d.getUTCDate()===lastDay(p.d).getUTCDate()?lastDay(addMonths(new Date(Date.UTC(p.d.getUTCFullYear(),p.d.getUTCMonth(),1)),num(n))):addMonths(p.d,num(n));return out(r,p.time);},
    LAST_DAY:onDate(d=>ymd(lastDay(d))),
    MONTHS_BETWEEN:(x,y)=>{const a=sqlDate(x),b=sqlDate(y);if(!a||!b)return null;const A=a.d,B=b.d;
      const months=(A.getUTCFullYear()-B.getUTCFullYear())*12+(A.getUTCMonth()-B.getUTCMonth());
      const bothLast=A.getUTCDate()===lastDay(A).getUTCDate()&&B.getUTCDate()===lastDay(B).getUTCDate();
      return A.getUTCDate()===B.getUTCDate()||bothLast?months:+(months+(A.getUTCDate()-B.getUTCDate())/31).toFixed(9);},
    DATE_PART:(u,x)=>{const p=sqlDate(x);return p?part(u,p.d):null;},DATEPART:(u,x)=>{const p=sqlDate(x);return p?part(u,p.d):null;},
    DATE_TRUNC:(u,x)=>{const p=sqlDate(x);if(!p)return null;const d=p.d,Y=d.getUTCFullYear(),M=d.getUTCMonth();let r;
      switch(unit(u)){case 'year':r=Date.UTC(Y,0,1);break;case 'quarter':r=Date.UTC(Y,M-M%3,1);break;case 'month':r=Date.UTC(Y,M,1);break;
        case 'week':r=Date.UTC(Y,M,d.getUTCDate()-((d.getUTCDay()+6)%7));break;case 'day':r=Date.UTC(Y,M,d.getUTCDate());break;
        case 'hour':r=Date.UTC(Y,M,d.getUTCDate(),d.getUTCHours());break;case 'minute':r=Date.UTC(Y,M,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes());break;default:return null;}
      return out(new Date(r),true);},
    DATE_FORMAT:(x,f)=>{const p=sqlDate(x);return p&&!isNull(f)?fmtMysql(p.d,f):null;},
    STR_TO_DATE:(s,f)=>{if(isNull(s)||isNull(f))return null;const p=parseWith(s,f,true);return p?out(p.d,p.time):null;},
    TO_TIMESTAMP:(s,f)=>{if(isNull(s)||isNull(f))return null;const p=parseWith(s,f,false);return p?out(p.d,true):null;},
    MAKE_DATE:(y,m,d)=>{if([y,m,d].some(v=>num(v)===null))return null;const r=new Date(Date.UTC(num(y),num(m)-1,num(d)));return r.getUTCMonth()===num(m)-1?ymd(r):null;},
    DATEFROMPARTS:(y,m,d)=>{if([y,m,d].some(v=>num(v)===null))return null;const r=new Date(Date.UTC(num(y),num(m)-1,num(d)));return r.getUTCMonth()===num(m)-1?ymd(r):null;},
    LEFT:(s,n)=>isNull(s)||num(n)===null?null:chars(str(s)).slice(0,Math.max(0,num(n))).join(''),
    RIGHT:(s,n)=>{if(isNull(s)||num(n)===null)return null;const a=chars(str(s)),k=Math.max(0,Math.trunc(num(n)));return k?a.slice(-k).join(''):'';},
    LEN:s=>isNull(s)?null:chars(str(s).replace(/ +$/,'')).length,
    CHAR_LENGTH:s=>isNull(s)?null:chars(str(s)).length,CHARACTER_LENGTH:s=>isNull(s)?null:chars(str(s)).length,
    LCASE:s=>isNull(s)?null:str(s).toLowerCase(),UCASE:s=>isNull(s)?null:str(s).toUpperCase(),
    /* UPPER et LOWER de SQLite ne changent que les lettres sans accent (3 ALLéE DES PINS) : comme PostgreSQL ou MySQL,
       les accents passent aussi en majuscules ou en minuscules (3 ALLÉE DES PINS ; cours Fonctions de texte). */
    UPPER:s=>isNull(s)?null:str(s).toUpperCase(),LOWER:s=>isNull(s)?null:str(s).toLowerCase(),
    STRPOS:(s,t)=>{if(isNull(s)||isNull(t))return null;const a=str(s),j=a.indexOf(str(t));return j<0?0:chars(a.slice(0,j)).length+1;},
    REPEAT:(s,n)=>isNull(s)||num(n)===null?null:str(s).repeat(Math.max(0,Math.trunc(num(n)))),
    INITCAP:s=>isNull(s)?null:str(s).toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase()),
    SPLIT_PART:(s,d,n)=>{if(isNull(s)||isNull(d)||num(n)===null)return null;const a=str(d)===''?[str(s)]:str(s).split(str(d)),k=Math.trunc(num(n));const v=k>0?a[k-1]:a[a.length+k];return v===undefined?'':v;},
    SPACE:n=>num(n)===null?null:' '.repeat(Math.max(0,Math.trunc(num(n)))),
    ASCII:s=>isNull(s)?null:(str(s)===''?0:str(s).codePointAt(0)),
    CHR:n=>num(n)===null?null:String.fromCodePoint(Math.trunc(num(n))),
    TRANSLATE:(s,a,b)=>{if(isNull(s)||isNull(a)||isNull(b))return null;const A=chars(str(a)),B=chars(str(b));return chars(str(s)).map(c=>{const i=A.indexOf(c);return i<0?c:(i<B.length?B[i]:'');}).join('');},
    REGEXP:(p,v)=>{if(isNull(p)||isNull(v))return null;const r=rx(p);return r?(r.test(str(v))?1:0):null;},
    CEILING:x=>num(x)===null?null:Math.ceil(num(x)),
    POW:(x,y)=>num(x)===null||num(y)===null?null:Math.pow(num(x),num(y)),
    LN:x=>num(x)===null||num(x)<=0?null:Math.log(num(x)),
    LOG:(b,x)=>num(b)===null||num(x)===null||num(b)<=0||num(b)===1||num(x)<=0?null:Math.log(num(x))/Math.log(num(b)),
    LOG2:x=>num(x)===null||num(x)<=0?null:Math.log2(num(x)),
    CBRT:x=>num(x)===null?null:Math.cbrt(num(x)),
    MOD:(a,b)=>num(a)===null||num(b)===null||num(b)===0?null:num(a)%num(b),
    TO_NUMBER:s=>num(isNull(s)?null:String(s).trim()),
    NVL:(a,b)=>isNull(a)?b:a,NVL2:(x,a,b)=>isNull(x)?b:a,
    IF:(c,a,b)=>truthy(c)?a:b
  };
  /* Fonctions à nombre d’arguments variable */
  const variadic={
    DATEDIFF:(...a)=>{
      if(a.length===2){const x=sqlDate(a[0]),y=sqlDate(a[1]);return x&&y?dayNum(x.d)-dayNum(y.d):null;}       // MySQL : DATEDIFF(fin, début), en jours
      if(a.length===3){const x=sqlDate(a[1]),y=sqlDate(a[2]);return x&&y?diff(a[0],x.d,y.d):null;}            // SQL Server : DATEDIFF('day', début, fin)
      return null;
    },
    EOMONTH:(x,n)=>{const p=sqlDate(x);if(!p)return null;const first=new Date(Date.UTC(p.d.getUTCFullYear(),p.d.getUTCMonth(),1));return ymd(lastDay(addMonths(first,num(n)||0)));},
    TO_CHAR:(x,f)=>{
      if(isNull(x))return null;
      const p=typeof x==='string'?sqlDate(x):null;
      if(isNull(f))return p?out(p.d,p.time):str(x);
      if(p)return fmtOracle(p.d,f);
      return num(x)!==null?fmtNumber(num(x),f):str(x);
    },
    TO_DATE:(s,f)=>{if(isNull(s))return null;const p=isNull(f)?sqlDate(s):parseWith(s,f,false);return p?out(p.d,p.time):null;},
    MID:(s,i,n)=>{if(isNull(s)||num(i)===null)return null;const a=chars(str(s));let k=Math.trunc(num(i));k=k<0?a.length+k:k-1;if(k<0)k=0;return a.slice(k,n===undefined?undefined:k+Math.max(0,Math.trunc(num(n)))).join('');},
    LOCATE:(t,s,i)=>{if(isNull(t)||isNull(s))return null;const a=str(s),k=Math.max(1,Math.trunc(num(i)||1));const j=a.indexOf(str(t),k-1);return j<0?0:chars(a.slice(0,j)).length+1;},
    LPAD:(s,n,p)=>lpad(s,n,p,false),RPAD:(s,n,p)=>lpad(s,n,p,true),
    BTRIM:(s,c)=>{if(isNull(s))return null;const set=isNull(c)||c===undefined?[' ']:chars(str(c));let a=chars(str(s));while(a.length&&set.includes(a[0]))a.shift();while(a.length&&set.includes(a[a.length-1]))a.pop();return a.join('');},
    REGEXP_LIKE:(s,p,f)=>{if(isNull(s)||isNull(p))return null;const r=rx(p,f);return r?(r.test(str(s))?1:0):null;},
    REGEXP_REPLACE:(s,p,t,f)=>{if(isNull(s)||isNull(p))return null;let r;try{r=new RegExp(String(p),'g'+String(f||'').replace(/[^imsuy]/g,''));}catch(e){return null;}return str(s).replace(r,isNull(t)?'':str(t).replace(/\\(\d)/g,'$$$1'));},
    REGEXP_SUBSTR:(s,p)=>{if(isNull(s)||isNull(p))return null;const r=rx(p);const m=r&&r.exec(str(s));return m?m[0]:null;},
    REGEXP_COUNT:(s,p)=>{if(isNull(s)||isNull(p))return null;let r;try{r=new RegExp(String(p),'g');}catch(e){return null;}return (str(s).match(r)||[]).length;},
    TRUNC:(x,d)=>trunc(x,d),TRUNCATE:(x,d)=>trunc(x,d),
    /* Elisa, 1er novembre, 18 h 24 : « vérifie si on peut encore plus booster le moteur ». Fonctions courantes qui manquaient. */
    WEEK:(x,mode)=>{const p=sqlDate(x);if(!p)return null;const d=p.d;if([1,3].includes(num(mode)))return isoWeek(d);
      const y0=Date.UTC(d.getUTCFullYear(),0,1),yd=Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-y0)/864e5);return Math.floor((yd+7-d.getUTCDay())/7);},
    NEXT_DAY:(x,j)=>{const p=sqlDate(x);if(!p||isNull(j))return null;const k=String(j).trim().toLowerCase().slice(0,3);
      const N={sun:0,dim:0,mon:1,lun:1,tue:2,mar:2,wed:3,mer:3,thu:4,jeu:4,fri:5,ven:5,sat:6,sam:6}[k];if(N===undefined)return null;
      const d=p.d;let e=(N-d.getUTCDay()+7)%7||7;return ymd(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+e)));},
    DATENAME:(u,x)=>{const p=sqlDate(x);if(!p)return null;const k=unit(u);if(k==='month')return MONTHS[p.d.getUTCMonth()];if(k==='dow'||/^(weekday|dw)$/i.test(String(u)))return DAYS[p.d.getUTCDay()];const v=part(u,p.d);return v===null?null:String(v);},
    DATALENGTH:x=>isNull(x)?null:new TextEncoder().encode(str(x)).length,
    BIT_LENGTH:x=>isNull(x)?null:8*new TextEncoder().encode(str(x)).length,
    PATINDEX:(pat,s)=>{if(isNull(pat)||isNull(s))return null;let q=String(pat);const debut=!q.startsWith('%');q=q.replace(/^%+|%+$/g,'');
      const re=q.split('').map(c=>c==='_'?'.':c==='%'?'.*':c.replace(/[.*+?^${}()|\\]/g,'\\$&')).join('').replace(/\\\[/g,'[').replace(/\\\]/g,']');
      let r;try{r=new RegExp((debut?'^':'')+re,'i');}catch(e){return null;}const m=r.exec(str(s));return m?m.index+1:0;},
    STUFF:(s,a,n,t)=>{if(isNull(s)||num(a)===null||num(n)===null)return null;const c=chars(str(s)),i=num(a)-1;if(i<0||i>c.length)return null;
      return c.slice(0,i).join('')+(isNull(t)?'':str(t))+c.slice(i+num(n)).join('');},
    ISNUMERIC:x=>isNull(x)?0:(typeof x==='number'||/^\s*[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(String(x))?1:0),
    GETUTCDATE:()=>out(new Date(),true),
    UNIX_TIMESTAMP:x=>{if(x===undefined)return Math.floor(Date.now()/1000);const p=sqlDate(x);return p?Math.floor(p.d.getTime()/1000):null;},
    FROM_UNIXTIME:n=>num(n)===null?null:out(new Date(num(n)*1000),true),
    FIELD:(x,...a)=>{if(isNull(x))return 0;const i=a.findIndex(v=>same(x,v));return i+1;},
    ELT:(n,...a)=>{const i=num(n);return i>=1&&i<=a.length?a[i-1]:null;},
    FIND_IN_SET:(x,l)=>{if(isNull(x)||isNull(l))return null;const i=str(l).split(',').indexOf(str(x));return i+1;},
    UUID:()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);}),
    GREATEST:(...a)=>pick(a,1),LEAST:(...a)=>pick(a,-1),
    RAND:()=>Math.random(),
    DECODE:(x,...a)=>{for(let i=0;i+1<a.length;i+=2)if(same(x,a[i]))return a[i+1];return a.length%2?a[a.length-1]:null;},
    /* 2 novembre, 20 h 48 : SOUNDEX (le code phonétique anglais de MySQL, SQL Server, Oracle) ; AGE de PostgreSQL (« 1 year 2 mons 3 days ») ;
       TIME_FORMAT de MySQL (les formats de DATE_FORMAT sur une heure) */
    SOUNDEX:s=>{if(isNull(s))return null;const w=str(s).normalize('NFD').replace(/[^A-Za-z]/g,'').toUpperCase();if(!w)return '';
      const code=c=>'BFPV'.includes(c)?'1':'CGJKQSXZ'.includes(c)?'2':'DT'.includes(c)?'3':c==='L'?'4':'MN'.includes(c)?'5':c==='R'?'6':'';
      let out=w[0],prev=code(w[0]);for(const c of w.slice(1)){const k=code(c);if(k&&k!==prev)out+=k;if(c!=='H'&&c!=='W')prev=k;if(out.length===4)break;}return out.padEnd(4,'0');},
    AGE:(a,b)=>{const pa=sqlDate(a);if(!pa)return null;let x=pa.d,y;if(b===undefined){y=x;x=new Date(Date.UTC(nowLocal().getUTCFullYear(),nowLocal().getUTCMonth(),nowLocal().getUTCDate()));}
      else{const pb=sqlDate(b);if(!pb)return null;y=pb.d;}
      const sg=x<y?-1:1;if(sg<0){const t=x;x=y;y=t;}
      let Y=x.getUTCFullYear()-y.getUTCFullYear(),M=x.getUTCMonth()-y.getUTCMonth(),D=x.getUTCDate()-y.getUTCDate();
      if(D<0){M--;D+=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),0)).getUTCDate();}if(M<0){Y--;M+=12;}
      const p=[];if(Y)p.push(`${sg*Y} year${Y>1?'s':''}`);if(M)p.push(`${sg*M} mon${M>1?'s':''}`);if(D||!p.length)p.push(`${sg*D} day${D>1?'s':''}`);return p.join(' ');},
    TIME_FORMAT:(x,f)=>{if(isNull(x)||isNull(f))return null;const v=str(x),p=sqlDate(/^\d{1,2}:\d{2}/.test(v)?'2000-01-01 '+v:v);return p?fmtMysql(p.d,f):null;}
  };
  variadic.NEWID=variadic.UUID;variadic.GEN_RANDOM_UUID=variadic.UUID;
  /* Agrégats : LISTAGG d’Oracle, écarts-types et variances (STDEV, VARIANCE et MEDIAN existent déjà dans le moteur). */
  const stats=(kind,sample)=>({init:()=>[],step:(st,x)=>{if(num(x)!==null)st.push(num(x));return st;},finalize:st=>{
    const a=st||[],n=a.length;if(!n||(sample&&n<2))return null;
    const m=a.reduce((s,v)=>s+v,0)/n,v=a.reduce((s,x)=>s+(x-m)*(x-m),0)/(sample?n-1:n);
    return kind==='sd'?Math.sqrt(v):v;}});
  const aggregate={
    LISTAGG:{variadic:true,init:()=>({v:[],sep:null}),step:(st,x,sep)=>{if(!isNull(x))st.v.push(str(x));if(st.sep===null&&sep!==undefined)st.sep=isNull(sep)?'':str(sep);return st;},
      finalize:st=>st&&st.v.length?st.v.join(st.sep===null?'':st.sep):null},
    STDDEV:stats('sd',true),STDDEV_SAMP:stats('sd',true),STDDEV_POP:stats('sd',false),STDEVP:stats('sd',false),
    VAR_SAMP:stats('var',true),VAR_POP:stats('var',false),VAR:stats('var',true),VARP:stats('var',false),
    /* 18 h 24 : tous vrais / au moins un vrai (PostgreSQL), percentiles et valeur la plus fréquente (réécrits depuis WITHIN GROUP). */
    BOOL_AND:{init:()=>null,step:(st,x)=>isNull(x)?st:(st===null?(num(x)?1:0):(st&&num(x)?1:0)),finalize:st=>st},
    BOOL_OR:{init:()=>null,step:(st,x)=>isNull(x)?st:(st===null?(num(x)?1:0):(st||num(x)?1:0)),finalize:st=>st},
    PERCENTILE_CONT:{init:()=>({v:[],p:null}),step:(st,x,p)=>{if(num(x)!==null)st.v.push(num(x));if(st.p===null&&num(p)!==null)st.p=num(p);return st;},
      finalize:st=>{if(!st||!st.v.length||st.p===null)return null;const a=st.v.sort((x,y)=>x-y),r=st.p*(a.length-1),lo=Math.floor(r),hi=Math.ceil(r);return a[lo]+(a[hi]-a[lo])*(r-lo);}},
    PERCENTILE_DISC:{init:()=>({v:[],p:null}),step:(st,x,p)=>{if(!isNull(x))st.v.push(x);if(st.p===null&&num(p)!==null)st.p=num(p);return st;},
      finalize:st=>{if(!st||!st.v.length||st.p===null)return null;const a=st.v.sort((x,y)=>typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y)));return a[Math.max(0,Math.ceil(st.p*a.length)-1)];}},
    MODE:{init:()=>new Map(),step:(st,x)=>{if(!isNull(x))st.set(x,(st.get(x)||0)+1);return st;},
      finalize:st=>{let best=null,n=0;if(st)for(const [k,c] of st){if(c>n||(c===n&&k<best)){best=k;n=c;}}return best;}}
  };
  aggregate.EVERY=aggregate.BOOL_AND;
  return {fixed,variadic,aggregate};
})();
/* Écritures d’autres SGBD réécrites pour SQLite juste avant l’exécution (hors textes entre guillemets et commentaires) :
   TOP n et FETCH FIRST n ROWS ONLY → LIMIT n ; EXTRACT(YEAR FROM d) → DATE_PART('year', d) ; DATEADD(day, …) → DATEADD('day', …) ;
   ISNULL(a, b) → IFNULL(a, b) ; CONVERT(type, x) et CAST(x AS DATE) ; DATE_ADD(d, INTERVAL 7 DAY) et d + INTERVAL '7 days' ;
   LISTAGG / STRING_AGG … WITHIN GROUP (ORDER BY …) → GROUP_CONCAT(… ORDER BY …) ; ILIKE → LIKE ; x::int → CAST(x AS INTEGER). */
function sqlCompat(sql){
  if(typeof sql!=='string'||!/\b(?:TOP|FETCH|OFFSET|EXTRACT|DATEADD|DATEDIFF|DATEPART|DATETRUNC|ISNULL|CONVERT|CAST|INTERVAL|WITHIN|ILIKE|SYSDATE|SYSTIMESTAMP|CURRENT_DATE|CURRENT_TIME|CURRENT_TIMESTAMP|SEPARATOR|POSITION|FORMAT|TRUNCATE|SERIAL|BIGSERIAL|SMALLSERIAL|AUTO_INCREMENT|IDENTITY|TRY_CAST|TRY_CONVERT|SUBSTRING|TRIM|RLIKE|PERCENTILE_CONT|PERCENTILE_DISC|MODE|DATENAME|TIMESTAMPDIFF|TIMESTAMPADD|ANY|SOME|ALL|ANY_VALUE|ARRAY_AGG|ARRAY|JSON_VALUE|JSON_QUERY|SAFE_CAST|VERSION|SIMILAR|SYMMETRIC|GENERATE_SERIES|DATE|TIMESTAMP|TIME|DISTINCT|CURRENT_USER|SESSION_USER|ROLLUP|CUBE|GROUPING|PIVOT)\b|::|~/i.test(sql))return sql;
  const keep=[];
  let t=sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]|--[^\n]*|\/\*[\s\S]*?\*\//g,m=>{keep.push(m);return '\u0001'+(keep.length-1)+'\u0002';});
  const PH=/^\u0001(\d+)\u0002$/;
  const textOf=ph=>{const m=PH.exec(ph.trim());if(!m)return null;const v=keep[+m[1]];return v[0]==="'"?v.slice(1,-1).replace(/''/g,"'"):null;};
  const isComment=ph=>{const m=PH.exec(ph);return !!m&&/^(--|\/\*)/.test(keep[+m[1]]);};
  const close=(s,i)=>{let d=0;for(let k=i;k<s.length;k++){if(s[k]==='(')d++;else if(s[k]===')'){d--;if(!d)return k;}}return -1;};
  const open=(s,i)=>{let d=0;for(let k=i;k>=0;k--){if(s[k]===')')d++;else if(s[k]==='('){d--;if(!d)return k;}}return -1;};
  const splitTop=s=>{const out=[];let d=0,last=0;for(let k=0;k<s.length;k++){const c=s[k];if(c==='(')d++;else if(c===')')d--;else if(c===','&&!d){out.push(s.slice(last,k));last=k+1;}}out.push(s.slice(last));return out;};
  /* Chaque appel NOM(…) : fn(contenu, suite, correspondance) renvoie [remplacement, caractères de la suite consommés] ou null */
  const calls=(re,fn)=>{let out='',i=0,m;re.lastIndex=0;
    while((m=re.exec(t))){
      const p=m.index+m[0].length-1,e=close(t,p);if(e<0)break;
      const r=fn(t.slice(p+1,e),t.slice(e+1),m);if(!r)continue;
      out+=t.slice(i,m.index)+r[0];i=e+1+(r[1]||0);re.lastIndex=i;
    }
    t=out+t.slice(i);};
  const TYPE=/^(?:INT|INTEGER|BIGINT|SMALLINT|TINYINT|SIGNED(?:\s+INTEGER)?|UNSIGNED(?:\s+INTEGER)?|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE(?:\s+PRECISION)?|MONEY|BIT|BOOLEAN|VARCHAR|NVARCHAR|CHAR|NCHAR|TEXT|DATE|DATETIME|DATETIME2|SMALLDATETIME|TIMESTAMP|TIMESTAMPTZ|TIME)(?:\s*\(\s*(?:\d+|MAX)(?:\s*,\s*\d+)?\s*\))?$/i;
  const castTo=(x,ty)=>{ty=ty.trim();
    if(/^DATE$/i.test(ty))return `DATE(${x})`;
    if(/^(?:DATETIME2?|SMALLDATETIME|TIMESTAMP(?:TZ)?)\b/i.test(ty))return `DATETIME(${x})`;
    if(/^TIME$/i.test(ty))return `TIME(${x})`;
    if(/^(?:SIGNED|UNSIGNED|BOOLEAN|BIT)\b/i.test(ty))return `CAST(${x} AS INTEGER)`;
    if(/^DOUBLE/i.test(ty))return `CAST(${x} AS REAL)`;
    return `CAST(${x} AS ${ty})`;};
  t=t.replace(/\bEXTRACT\s*\(\s*([A-Za-z]+)\s+FROM\s+/gi,(m,u)=>`DATE_PART('${u.toLowerCase()}', `);
  t=t.replace(/\bTRY_CAST\s*\(/gi,'CAST(').replace(/\bTRY_CONVERT\s*\(/gi,'CONVERT(').replace(/\bTIMESTAMPDIFF\s*\(/gi,'DATEDIFF(').replace(/\bTIMESTAMPADD\s*\(/gi,'DATEADD(');
  t=t.replace(/\b(DATEADD|DATEDIFF|DATEPART|DATETRUNC|DATENAME)\s*\(\s*(year|yyyy|yy|quarter|qq|q|month|mm|m|week|wk|ww|dayofyear|dy|y|day|dd|d|hour|hh|minute|mi|n|second|ss|s|weekday|dw)\s*,/gi,
    (m,f,u)=>`${/^DATETRUNC$/i.test(f)?'DATE_TRUNC':f}('${u.toLowerCase()}',`);
  t=t.replace(/\bISNULL\s*\(/gi,'IFNULL(').replace(/\bILIKE\b/gi,'LIKE').replace(/\bNOT\s+RLIKE\b/gi,'NOT REGEXP').replace(/\bRLIKE\b/gi,'REGEXP');
  /* x ~ 'motif' (PostgreSQL) → x REGEXP 'motif' ; !~ → NOT REGEXP. Seulement entre deux opérandes, pas le ~ unaire (non binaire). */
  t=t.replace(/([\w)\u0002])(\s+)(!?)~\*?(\s+)(?=[\u0001\w(])/g,(m,a,s1,neg,s2,off,all)=>{const w=/([A-Za-z_]\w*)$/.exec(all.slice(0,off+1));
    if(w&&/^(SELECT|WHERE|AND|OR|NOT|ON|THEN|ELSE|WHEN|CASE|RETURN|IN|IS|BY|AS|HAVING|SET|VALUES)$/i.test(w[1]))return m;return `${a}${s1}${neg?'NOT ':''}REGEXP${s2}`;});
  t=t.replace(/\bSYSDATE\b(?!\s*\()/gi,'SYSDATE()').replace(/\bSYSTIMESTAMP\b(?!\s*\()/gi,'NOW()').replace(/\b(CURRENT_DATE|CURRENT_TIMESTAMP|CURRENT_TIME)\s*\(\s*\)/gi,'$1');
  /* CURRENT_DATE - 1 (PostgreSQL), SYSDATE + 7 (Oracle) : des jours. */
  t=t.replace(/\b(CURRENT_DATE|SYSDATE\(\))\s*([+-])\s*(\d+(?:\.\d+)?)\b(?![.(])(?!\s+(?:YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)S?\b)/gi,(m,x,sg,n)=>`DATEADD('day', ${sg==='-'?'-':''}${n}, ${/^SYSDATE/i.test(x)?'SYSDATE()':'CURRENT_DATE'})`);
  t=t.replace(/\bOFFSET\s+(\d+)\s+ROWS?\s+FETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY\b/gi,'LIMIT $2 OFFSET $1')
     .replace(/\bFETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY\b/gi,'LIMIT $1').replace(/\bFETCH\s+(?:FIRST|NEXT)\s+ROWS?\s+ONLY\b/gi,'LIMIT 1')
     .replace(/\bOFFSET\s+(\d+)\s+ROWS?\b/gi,'LIMIT -1 OFFSET $1');
  calls(/\bCONVERT\s*\(/gi,inner=>{const a=splitTop(inner);
    if(a.length>=2&&TYPE.test(a[0].trim()))return [castTo(a[1].trim(),a[0])];                 // SQL Server : CONVERT(type, x[, style])
    if(a.length===2&&TYPE.test(a[1].trim()))return [castTo(a[0].trim(),a[1])];                // MySQL : CONVERT(x, type)
    return null;});
  calls(/\bCAST\s*\(/gi,inner=>{const m=/^([\s\S]*\S)\s+AS\s+([A-Za-z][\w ]*(?:\([^)]*\))?)\s*$/i.exec(inner);
    return m&&/^(?:DATE|DATETIME2?|SMALLDATETIME|TIMESTAMP(?:TZ)?|TIME|SIGNED|UNSIGNED|BOOLEAN|DOUBLE)\b/i.test(m[2].trim())?[castTo(m[1].trim(),m[2])]:null;});
  calls(/\b(DATE_ADD|DATE_SUB|ADDDATE|SUBDATE)\s*\(/gi,(inner,after,m)=>{const a=splitTop(inner);if(a.length!==2)return null;
    const iv=/^\s*INTERVAL\s+([\s\S]+?)\s+([A-Za-z]+)\s*$/i.exec(a[1]);if(!iv)return null;
    const neg=/SUB/i.test(m[1]);return [`DATEADD('${iv[2].toLowerCase()}', ${neg?'-(':''}${iv[1].trim()}${neg?')':''}, ${a[0].trim()})`];});
  /* Un intervalle, simple ('7 days', 7 DAY) ou composé ('1 month - 1 day', '1 year 2 months') : [[nombre signé, unité], …] */
  const ivParts=(txt,u1)=>{const out=[];let sg=1,rest=String(txt).trim();
    const re=/^([+-])?\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*/;
    while(rest){const q=re.exec(rest);if(!q||!q[0])return null;const unit=q[3]||(out.length?null:u1);if(!unit)return null;
      if(q[1])sg=q[1]==='-'?-1:1;out.push([sg*+q[2],unit.toLowerCase()]);rest=rest.slice(q[0].length);}
    return out.length?out:null;};
  const ivApply=(x,sign,parts)=>parts.reduce((acc,[n,u])=>`DATEADD('${u}', ${sign==='-'?-n:n}, ${acc})`,x);
  const ivOf=(ph,u1,n,u2)=>{if(ph){const v=textOf(ph);return v===null?null:ivParts(v,u1);}return ivParts(n+' '+u2);};
  const SQL_MOTS=/^(SELECT|FROM|WHERE|AND|OR|NOT|ON|AS|BY|THEN|ELSE|WHEN|CASE|RETURN|IN|IS|LIKE|BETWEEN|SET|VALUES|HAVING|USING)$/i;
  t=t.replace(/((?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*(?:\s*\(\s*\))?|\u0001\d+\u0002)\s*([+-])\s*INTERVAL\s+(?:(\u0001\d+\u0002)(?:\s+((?:YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND|QUARTER)S?)\b)?|(\d+)\s+((?:YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND|QUARTER)S?)\b)/gi,
    (m,x,sign,ph,u1,n,u2)=>{
      if(SQL_MOTS.test(x))return m;
      const parts=ivOf(ph,u1,n,u2);return parts?ivApply(x,sign,parts):m;});
  /* … et après un appel de fonction ou une parenthèse : DATE_TRUNC('month', d) + INTERVAL '1 month - 1 day' (16 h 24, « booster le moteur ») */
  for(let guard=0;guard<50;guard++){
    const m=/\)\s*([+-])\s*INTERVAL\s+(?:(\u0001\d+\u0002)(?:\s+((?:YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND|QUARTER)S?)\b)?|(\d+)\s+((?:YEAR|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND|QUARTER)S?)\b)/i.exec(t);if(!m)break;
    const e=m.index;let a=open(t,e);if(a<0)break;
    const fn=/[A-Za-z_]\w*\s*$/.exec(t.slice(0,a));if(fn&&!SQL_MOTS.test(fn[0].trim()))a-=fn[0].length;
    const parts=ivOf(m[2],m[3],m[4],m[5]);if(!parts)break;
    const rep=ivApply(t.slice(a,e+1),m[1],parts);
    t=t.slice(0,a)+rep+t.slice(m.index+m[0].length);
  }
  calls(/\b(LISTAGG|STRING_AGG)\s*\(/gi,(inner,after)=>{
    const w=/^\s*WITHIN\s+GROUP\s*\(/i.exec(after);if(!w)return null;
    const p=w.index+w[0].length-1,e=close(after,p);if(e<0)return null;
    const ob=/^\s*ORDER\s+BY\s+([\s\S]+?)\s*$/i.exec(after.slice(p+1,e));if(!ob)return null;
    const a=splitTop(inner),sep=a.length>1?a.slice(1).join(',').trim():"''";
    return [`GROUP_CONCAT(${a[0].trim()}, ${sep} ORDER BY ${ob[1]})`,e+1];});
  /* GROUP_CONCAT(nom ORDER BY nom SEPARATOR ', ') de MySQL ; POSITION('@' IN email) ; FORMAT(d, 'dd/MM/yyyy') de SQL Server */
  calls(/\bGROUP_CONCAT\s*\(/gi,inner=>{const m=/^([\s\S]*?)\s+SEPARATOR\s+(\u0001\d+\u0002)\s*$/i.exec(inner);if(!m)return null;
    const ob=/^([\s\S]*?)\s+(ORDER\s+BY\s+[\s\S]+)$/i.exec(m[1]);
    return [ob?`GROUP_CONCAT(${ob[1].trim()}, ${m[2]} ${ob[2].trim()})`:`GROUP_CONCAT(${m[1].trim()}, ${m[2]})`];});
  /* SUBSTRING(x FROM a FOR b) ; TRIM(BOTH|LEADING|TRAILING c FROM x) (norme SQL, PostgreSQL) */
  /* Le texte, parenthèses intérieures masquées (même longueur) : un FROM de sous-requête ne compte pas. */
  const flat=s=>{let d=0,o='';for(const c of s){if(c==='('){d++;o+=d>1?' ':c;continue;}if(c===')'){o+=d>1?' ':c;d--;continue;}o+=d>0?' ':c;}return o;};
  const topSplit=(inner,re)=>{const m=re.exec(flat(inner));if(!m)return null;let k=0;return m.slice(1).map(g=>{if(g===undefined)return undefined;const i=flat(inner).indexOf(g,k);k=i+g.length;return inner.slice(i,i+g.length);});};
  calls(/\bSUBSTRING\s*\(/gi,inner=>{const m=topSplit(inner,/^([\s\S]+?)\s+FROM\s+([\s\S]+?)(?:\s+FOR\s+([\s\S]+))?$/i);return m?[`SUBSTR(${m[0].trim()}, ${m[1].trim()}${m[2]?', '+m[2].trim():''})`]:null;});
  calls(/\bTRIM\s*\(/gi,inner=>{const g=topSplit(inner,/^\s*(BOTH|LEADING|TRAILING)?\s*([\s\S]*?)\s*\bFROM\s+([\s\S]+)$/i);const m=g&&[null,...g];if(!m||(!m[1]&&!m[2]))return null;
    const f={LEADING:'LTRIM',TRAILING:'RTRIM'}[String(m[1]||'').toUpperCase()]||'TRIM';return [`${f}(${m[3].trim()}${m[2]?', '+m[2].trim():''})`];});
  /* PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x) ; MODE() WITHIN GROUP (ORDER BY x) */
  calls(/\b(PERCENTILE_CONT|PERCENTILE_DISC|MODE)\s*\(/gi,(inner,after,m)=>{
    const w=/^\s*WITHIN\s+GROUP\s*\(/i.exec(after);if(!w)return null;
    const p=w.index+w[0].length-1,e=close(after,p);if(e<0)return null;
    const ob=/^\s*ORDER\s+BY\s+([\s\S]+?)(?:\s+(ASC|DESC))?\s*$/i.exec(after.slice(p+1,e));if(!ob)return null;
    const f=m[1].toUpperCase();if(f==='MODE')return [`MODE(${ob[1]})`,e+1];
    const q=inner.trim(),desc=/DESC/i.test(ob[2]||'');return [`${f}(${ob[1]}, ${desc?`1 - (${q})`:q})`,e+1];});
  calls(/\bPOSITION\s*\(/gi,inner=>{const m=/^([\s\S]+?)\s+IN\s+([\s\S]+)$/i.exec(inner);return m?[`INSTR(${m[2].trim()}, ${m[1].trim()})`]:null;});
  calls(/\bFORMAT\s*\(/gi,inner=>{const a=splitTop(inner);if(a.length!==2)return null;const f=textOf(a[1]);
    if(f===null||f.includes('%')||!/yyyy|yy|MM|dd|HH|mm|ss/.test(f))return null;
    const conv=f.replace(/yyyy|yy|MM|dd|HH|mm|ss/g,k=>({yyyy:'%Y',yy:'%y',MM:'%m',dd:'%d',HH:'%H',mm:'%M',ss:'%S'})[k]);
    return [`STRFTIME('${conv.replace(/'/g,"''")}', ${a[0].trim()})`];});
  /* x::type de PostgreSQL */
  for(let k=t.indexOf('::');k>=0;k=t.indexOf('::',k+2)){
    const after=/^::\s*([A-Za-z]\w*(?:\s+precision)?(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/i.exec(t.slice(k));if(!after)continue;
    let a=k;
    if(t[k-1]===')'){a=open(t,k-1);if(a<0)continue;const fn=/[A-Za-z_]\w*\s*$/.exec(t.slice(0,a));if(fn&&!SQL_MOTS.test(fn[0].trim()))a-=fn[0].length;}
    else{const op=/(?:(?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*|\d+(?:\.\d+)?|\u0001\d+\u0002)$/.exec(t.slice(0,k));if(!op)continue;a=k-op[0].length;}
    const ty=after[1].replace(/\bint\b|\binteger\b|\bbigint\b|\bsmallint\b/i,'INTEGER').replace(/\btext\b|\bvarchar\b/i,'TEXT');
    const rep=castTo(t.slice(a,k),ty);
    t=t.slice(0,a)+rep+t.slice(k+after[0].length);k=a+rep.length-2;
  }
  /* Elisa, 2 novembre, 20 h 48 : « il y a d’autres fonctions que tu peux ajouter dans le moteur ? ». Les écritures qui manquaient encore :
     DATE '2026-07-02' et TIMESTAMP '…' (littéraux typés) ; ANY_VALUE (MySQL, PostgreSQL) ; ARRAY_AGG (PostgreSQL : un tableau JSON) ;
     JSON_VALUE et JSON_QUERY (SQL Server, Oracle, MySQL) ; SAFE_CAST (BigQuery) ; VERSION() ; CURRENT_USER ; x SIMILAR TO 'motif' ;
     BETWEEN SYMMETRIC ; generate_series(début, fin[, pas]) dans FROM (PostgreSQL), nombres ou dates ; = ANY (ARRAY[…]) ;
     STRING_AGG / GROUP_CONCAT (DISTINCT x, séparateur) (SQLite n’accepte DISTINCT qu’avec un seul argument). */
  t=t.replace(/\b(DATE|TIMESTAMP|TIME)\s+(\u0001\d+\u0002)/gi,(m,k,ph)=>{const v=textOf(ph);if(v===null)return m;
    const f=/^DATE$/i.test(k)?'DATE':/^TIME$/i.test(k)?'TIME':'DATETIME';return `${f}(${ph})`;});
  t=t.replace(/\bANY_VALUE\s*\(/gi,'MIN(').replace(/\bARRAY_AGG\s*\(/gi,'json_group_array(').replace(/\b(JSON_VALUE|JSON_QUERY)\s*\(/gi,'json_extract(')
     .replace(/\bSAFE_CAST\s*\(/gi,'CAST(').replace(/\bVERSION\s*\(\s*\)/gi,"('SQLite ' || sqlite_version())")
     .replace(/\b(CURRENT_USER|SESSION_USER)\b(?!\s*\()/gi,"'eleve'");
  t=t.replace(/\b(NOT\s+)?SIMILAR\s+TO\s+(\u0001\d+\u0002)/gi,(m,neg,ph)=>{const v=textOf(ph);if(v===null)return m;
    const re='^(?:'+v.replace(/[.\\^$]/g,'\\$&').replace(/%/g,'.*').replace(/_/g,'.')+')$';keep.push("'"+re.replace(/'/g,"''")+"'");
    return `${neg?'NOT ':''}REGEXP \u0001${keep.length-1}\u0002`;});
  const TOK='(?:[+-]?\\d+(?:\\.\\d+)?|\\u0001\\d+\\u0002|(?:[A-Za-z_]\\w*\\.)?[A-Za-z_]\\w*)';
  t=t.replace(new RegExp(`\\bBETWEEN\\s+SYMMETRIC\\s+(${TOK})\\s+AND\\s+(${TOK})`,'gi'),(m,a,b)=>`BETWEEN MIN(${a}, ${b}) AND MAX(${a}, ${b})`);
  /* ARRAY['a', 'b'] (masqué comme un nom entre crochets) dans ANY / ALL / IN : une liste de valeurs (VALUES) */
  t=t.replace(/\b(ANY|SOME|ALL|IN)\s*\(\s*ARRAY\s*(\u0001\d+\u0002)\s*\)/gi,(m,k,ph)=>{const v=keep[+PH.exec(ph)[1]];if(v[0]!=='[')return m;
    const items=v.slice(1,-1).match(/'(?:[^']|'')*'|[^,]+/g)||[];const vals=items.map(x=>x.trim()).filter(Boolean);if(!vals.length)return m;
    return /^IN$/i.test(k)?`IN (${vals.join(', ')})`:`${k} (VALUES ${vals.map(x=>`(${x})`).join(', ')})`;});
  /* generate_series dans FROM : une suite construite par une requête récursive (100 000 lignes au plus) */
  {let ng=0;calls(/\bgenerate_series\s*\(/gi,(inner,after,m)=>{
    if(!/\bFROM\s*$|\bJOIN\s*$|,\s*$/i.test(t.slice(0,m.index)))return null;
    const a=splitTop(inner);if(a.length<2||a.length>3)return null;
    const deb=a[0].trim(),fin=a[1].trim(),pas=a[2]?a[2].trim():'1';
    const al=/^\s+(?:AS\s+)?([A-Za-z_]\w*)(?:\s*\(\s*([A-Za-z_]\w*)\s*\))?/i.exec(after);
    const nom=al&&!/^(WHERE|JOIN|ON|GROUP|ORDER|LIMIT|LEFT|INNER|CROSS|UNION|HAVING)$/i.test(al[1])?al:null;
    const col=nom&&nom[2]?nom[2]:'generate_series',q='__gs'+(++ng);
    const ivs=textOf(pas),ivd=ivs!==null?/^\s*(\d+)\s*([A-Za-z]+?)s?\s*$/.exec(ivs):/^INTERVAL\s+(\d+)\s+([A-Za-z]+?)S?$/i.exec(pas);
    const suiv=ivd?`DATE(v, '+${ivd[1]} ${ivd[2].toLowerCase()}')`:`v + (${pas})`;
    const cmp=!ivd&&/^-/.test(pas)?'>=':'<=';
    const src=`(WITH RECURSIVE ${q}(v) AS (SELECT ${deb} UNION ALL SELECT ${suiv} FROM ${q} WHERE ${suiv} ${cmp} ${fin} LIMIT 100000) SELECT v AS ${col}${col==='generate_series'?', v AS value':''} FROM ${q})`;
    return [src+(nom?` AS ${nom[1]}`:''),nom?nom[0].length:0];});}
  /* STRING_AGG / GROUP_CONCAT (DISTINCT x, séparateur [ORDER BY …]) : SQLite ne prend qu’un argument avec DISTINCT */
  calls(/\b(STRING_AGG|GROUP_CONCAT)\s*\(/gi,(inner)=>{if(!/^\s*DISTINCT\b/i.test(inner))return null;const a=splitTop(inner);if(a.length!==2)return null;
    const x=a[0].replace(/^\s*DISTINCT\s+/i,'').trim(),ob=/^([\s\S]*?)\s+ORDER\s+BY\s+([\s\S]+)$/i.exec(a[1].trim()),sep=ob?ob[1]:a[1].trim();
    return [`REPLACE(REPLACE(GROUP_CONCAT(DISTINCT REPLACE(${x}, ',', char(31))${ob?' ORDER BY '+ob[2]:''}), ',', ${sep}), char(31), ',')`];});
  /* Comparaison à une sous-requête avec ANY / SOME / ALL (absents de SQLite ; cours « ANY et ALL ») : la valeur à battre est calculée
     dans une sous-requête nommée (WITH, qui garde la corrélation) : > ANY → plus grand que le minimum, > ALL → plus grand que le
     maximum (un ensemble vide laisse tout passer, comme ALL) ; = ANY → IN, <> ALL → NOT IN ; = ALL et <> ANY : une seule valeur
     distincte. Une sous-requête imbriquée est réécrite au tour suivant. */
  {let nq=0;
  for(let tour=0;tour<6&&/\b(?:ANY|SOME|ALL)\s*\(/i.test(t);tour++){const avant=t;
    calls(/(<>|!=|<=|>=|=|<|>)\s*(ANY|SOME|ALL)\s*\(/gi,(inner,suite,m)=>{
      if(!/^\s*(?:\u0001\d+\u0002\s*)*(?:SELECT|WITH|VALUES)\b/i.test(inner))return null;
      const op=m[1]==='!='?'<>':m[1],tous=/^ALL$/i.test(m[2]),q='__q'+(++nq),cte=`WITH ${q}(__v) AS (${inner})`;
      const une=`(${cte} SELECT MIN(__v) FROM ${q} HAVING COUNT(DISTINCT __v)=1 AND COUNT(__v)=COUNT(*))`;
      if(op==='=')return [tous?`IN ${une}`:`IN (${inner})`];
      if(op==='<>')return [tous?`NOT IN (${inner})`:`NOT IN ${une}`];
      const haut=op[0]==='>';
      const agg=tous?(haut?'MAX':'MIN'):(haut?'MIN':'MAX');
      return [`${op} (${cte} SELECT ${tous?`COALESCE(${agg}(__v), ${haut?'-9e999':'9e999'})`:`${agg}(__v)`} FROM ${q})`];});
    if(t===avant)break;}}
  /* TRUNCATE TABLE t → DELETE FROM t (début d’instruction seulement : TRUNCATE(x, 2) reste la fonction de MySQL). */
  t=t.replace(/(^|;)(\s*(?:\u0001\d+\u0002\s*)*)TRUNCATE\s+(?:TABLE\s+)?(?=[A-Za-z_"`\[\u0001])/gi,'$1$2DELETE FROM ');
  /* Un identifiant qui s’incrémente, écrit à la PostgreSQL (SERIAL), MySQL (AUTO_INCREMENT), SQL Server (IDENTITY(1,1)) ou Oracle
     (GENERATED … AS IDENTITY) : SQLite ne l’accepte qu’en INTEGER PRIMARY KEY. Sans cette réécriture, la table se créait mais ses id
     restaient vides (NULL) à chaque INSERT. */
  t=t.split(';').map(st=>{
    if(!/^\s*(?:\u0001\d+\u0002\s*)*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\b/i.test(st))return st;
    const AI=/\b([A-Za-z_]\w*|"[^"]+"|`[^`]+`)\s+(?:(?:BIG|SMALL)?SERIAL\d?\b|(?:INT|INTEGER|BIGINT|SMALLINT|MEDIUMINT|TINYINT|NUMBER|NUMERIC|DECIMAL)(?:\s*\([^)]*\))?(?:\s+UNSIGNED)?(?:\s+NOT\s+NULL)?\s+(?:AUTO_INCREMENT\b|IDENTITY(?:\s*\([^)]*\))?|GENERATED\s+(?:ALWAYS\s+|BY\s+DEFAULT\s+(?:ON\s+NULL\s+)?)?AS\s+IDENTITY(?:\s*\([^)]*\))?))((?:\s+NOT\s+NULL)?(?:\s+PRIMARY\s+KEY)?)/gi;
    return st.replace(AI,(m,name,tail)=>{
      const pk=/PRIMARY\s+KEY/i.test(tail),autre=/PRIMARY\s+KEY/i.test(st.replace(m,''));
      return pk||!autre?`${name} INTEGER PRIMARY KEY`:`${name} INTEGER`;});
  }).join(';');
  /* SELECT TOP n … → … LIMIT n (instruction par instruction, avant un commentaire final) */
  t=t.split(';').map(st=>{
    const m=/^(\s*SELECT\s+(?:DISTINCT\s+)?)TOP\s*\(?\s*(\d+)\s*\)?\s+/i.exec(st);
    if(!m||/\bLIMIT\b/i.test(st))return st;
    let body=st.slice(m[0].length),tail='';
    const tm=/(?:\s|\u0001\d+\u0002)*$/.exec(body);
    if(tm&&tm[0]&&tm[0].split(/(\u0001\d+\u0002)/).every(x=>!x||/^\s*$/.test(x)||isComment(x))){tail=tm[0];body=body.slice(0,body.length-tail.length);}
    return m[1]+body+' LIMIT '+m[2]+tail;
  }).join(';');
  /* Elisa, 2 novembre, 21 h 03 : « fais-le ». ROLLUP, CUBE, GROUPING SETS (et WITH ROLLUP de MySQL) : une requête par regroupement,
     réunies par UNION ALL (les colonnes absentes du regroupement valent NULL ; GROUPING(x) vaut 1 quand x est « tout ») ; l’ORDER BY passe
     sur le résultat réuni. PIVOT (SQL Server, Oracle) : une colonne par valeur, calculée avec CASE, la source étant une sous-requête qui
     nomme ses colonnes. Hors de ces cas simples (UNION dans la même requête, source PIVOT sans colonnes nommées), un message clair. */
  if(/\b(?:ROLLUP|CUBE|GROUPING\s+SETS|PIVOT)\b/i.test(t)){
    const depthAt=s=>{const a=new Array(s.length);let d=0;for(let k=0;k<s.length;k++){if(s[k]===')')d--;a[k]=d;if(s[k]==='(')d++;}return a;};
    const topAll=(s,re)=>{const dp=depthAt(s),out=[];let m;re.lastIndex=0;while((m=re.exec(s))){if(dp[m.index]===0)out.push(m);if(!m[0])re.lastIndex++;}return out;};
    const nrm=x=>x.replace(/\s+/g,'').toLowerCase();
    const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const AGG=/\b(?:SUM|COUNT|AVG|MIN|MAX|TOTAL|GROUP_CONCAT|STRING_AGG|LISTAGG|json_group_array|MEDIAN|STDDEV\w*|VAR\w*)\s*\(/gi;
    /* Une colonne absente du regroupement devient NULL, sauf dans un agrégat (SUM(prix) reste SUM(prix)). */
    const sansCols=(x,absentes,S)=>{
      x=x.replace(/\bGROUPING\s*\(([^()]*)\)/gi,(m,c)=>S.some(s=>nrm(s)===nrm(c))?'0':'1');
      if(!absentes.length)return x;
      const spans=[];let m;AGG.lastIndex=0;while((m=AGG.exec(x))){const p=m.index+m[0].length-1,e=close(x,p);if(e<0)break;spans.push([m.index,e+1]);AGG.lastIndex=e+1;}
      let out='',i=0;const part=s=>absentes.reduce((acc,c)=>acc.replace(new RegExp(`(^|[^\\w.])${esc(c.trim())}(?![\\w(])`,'gi'),'$1NULL'),s);
      for(const [a,b] of spans){out+=part(x.slice(i,a))+x.slice(a,b);i=b;}
      return out+part(x.slice(i));};
    t=t.split(';').map(st=>{
      if(!/\b(?:ROLLUP|CUBE|GROUPING\s+SETS|PIVOT)\b/i.test(st))return st;
      /* PIVOT */
      const pv=topAll(st,/\bPIVOT\s*\(/gi)[0];
      if(pv){
        const fr=topAll(st.slice(0,pv.index),/\bFROM\b/gi).pop();if(!fr)return st;
        const p=pv.index+pv[0].length-1,e=close(st,p);if(e<0)return st;
        const body=/^\s*([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s+FOR\s+((?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*)\s+IN\s*\(([\s\S]*)\)\s*$/i.exec(st.slice(p+1,e));
        if(!body)throw new Error('PIVOT : écris-le sous la forme PIVOT (SUM(valeur) FOR colonne IN (…)).');
        const [,agg,val,col,list]=body;
        let src=st.slice(fr.index+fr[0].length,pv.index).trim();
        const sq=/^\(([\s\S]*)\)\s*(?:AS\s+)?([A-Za-z_]\w*)?$/i.exec(src);
        if(!sq||!/^\s*SELECT\b/i.test(sq[1]))throw new Error('PIVOT : la source doit être une sous-requête qui nomme ses colonnes, par exemple FROM (SELECT categorie, mois, prix FROM produits) AS src PIVOT (…).');
        const inner=sq[1],fromIn=topAll(inner,/\bFROM\b/gi)[0];
        const cols=splitTop(inner.slice(inner.search(/\bSELECT\b/i)+6,fromIn?fromIn.index:inner.length).replace(/^\s*DISTINCT\b/i,'')).map(c=>{
          const a=/\s(?:AS\s+)?([A-Za-z_]\w*)\s*$/i.exec(c.trim())||/(?:^|\.)([A-Za-z_]\w*)\s*$/.exec(c.trim());return a?a[1]:null;});
        if(cols.some(c=>!c||c==='*'))throw new Error('PIVOT : nomme chaque colonne de la sous-requête (pas d’étoile).');
        const nomCol=col.split('.').pop(),nomVal=val.trim().split('.').pop();
        const grp=cols.filter(c=>nrm(c)!==nrm(nomCol)&&nrm(c)!==nrm(nomVal));
        const items=splitTop(list).map(x=>{x=x.trim();const ph=PH.exec(x.replace(/\s+(?:AS\s+)?[A-Za-z_]\w*$/i,''));
          const al=/\s(?:AS\s+)?([A-Za-z_]\w*)$/i.exec(x);
          if(ph){const k=keep[+ph[1]];const v=k[0]==='['?k.slice(1,-1):textOf(ph[0]);if(v===null)return null;
            return {v:/^-?\d+(\.\d+)?$/.test(v)&&k[0]==='['?v:`'${v.replace(/'/g,"''")}'`,n:al?al[1]:v};}
          if(/^-?\d+(\.\d+)?$/.test(x))return {v:x,n:x};return null;});
        if(!items.length||items.some(i=>!i))throw new Error('PIVOT : les valeurs de IN (…) s’écrivent [valeur] ou \'valeur\'.');
        const after=st.slice(e+1),al=/^\s+(?:AS\s+)?([A-Za-z_]\w*)\b/i.exec(after);
        const kw=al&&/^(WHERE|GROUP|ORDER|LIMIT|HAVING|UNION|JOIN)$/i.test(al[1])?null:al;
        const piv=`(SELECT ${grp.length?grp.join(', ')+', ':''}${items.map(i=>`${agg}(CASE WHEN ${nomCol} = ${i.v} THEN ${nomVal} END) AS "${i.n.replace(/"/g,'""')}"`).join(', ')} FROM ${src}${sq[2]?'':' AS src'}${grp.length?' GROUP BY '+grp.join(', '):''}) AS ${kw?kw[1]:'pvt'}`;
        return st.slice(0,fr.index+fr[0].length)+' '+piv+(kw?after.slice(kw[0].length):after);
      }
      /* ROLLUP, CUBE, GROUPING SETS, WITH ROLLUP */
      if(topAll(st,/\b(?:UNION|INTERSECT|EXCEPT)\b/gi).length)throw new Error('ROLLUP, CUBE et GROUPING SETS : seulement dans une requête sans UNION, INTERSECT ni EXCEPT.');
      const sel=topAll(st,/\bSELECT\b/gi)[0],gb=topAll(st,/\bGROUP\s+BY\b/gi)[0];if(!sel||!gb)return st;
      const ends=topAll(st,/\b(?:HAVING|WINDOW|ORDER\s+BY|LIMIT)\b/gi).filter(m=>m.index>gb.index);
      const cut=(re,from)=>{const m=topAll(st,re).find(x=>x.index>=from);return m;};
      const fromM=cut(/\bFROM\b/gi,sel.index);if(!fromM)return st;
      const whereM=topAll(st,/\bWHERE\b/gi).find(x=>x.index>fromM.index&&x.index<gb.index);
      const havM=ends.find(m=>/^HAVING/i.test(m[0])),ordM=ends.find(m=>/^ORDER/i.test(m[0])),limM=ends.find(m=>/^LIMIT/i.test(m[0])),winM=ends.find(m=>/^WINDOW/i.test(m[0]));
      if(winM)throw new Error('ROLLUP, CUBE et GROUPING SETS : pas avec WINDOW.');
      const gEnd=ends.length?ends[0].index:st.length;
      let gtxt=st.slice(gb.index+gb[0].length,gEnd),withRollup=false;
      gtxt=gtxt.replace(/\s+WITH\s+ROLLUP\s*$/i,()=>{withRollup=true;return '';});
      const prefix=st.slice(0,sel.index);
      let selList=st.slice(sel.index+6,fromM.index),distinct='';
      selList=selList.replace(/^\s*(DISTINCT|ALL)\b/i,m=>{distinct=m.trim()+' ';return '';});
      const fromTxt=st.slice(fromM.index,gb.index);
      const havTxt=havM?st.slice(havM.index+havM[0].length,ordM?ordM.index:(limM?limM.index:st.length)):null;
      const ordTxt=ordM?st.slice(ordM.index+ordM[0].length,limM?limM.index:st.length):null;
      const limTxt=limM?st.slice(limM.index):'';
      /* Les regroupements : le produit des éléments du GROUP BY */
      const prefixes=c=>c.map((_,k)=>c.slice(0,c.length-k)).concat([[]]);
      const subsets=c=>{let r=[[]];for(const x of c)r=r.flatMap(s=>[s.concat([x]),s]);return r.sort((a,b)=>b.length-a.length);};
      const flat=x=>{const m=/^\(([\s\S]*)\)$/.exec(x.trim());return m?splitTop(m[1]).map(s=>s.trim()).filter(Boolean):[x.trim()];};
      const opts=splitTop(gtxt).map(x=>x.trim()).filter(Boolean).map(x=>{
        let m;
        if((m=/^ROLLUP\s*\(([\s\S]*)\)$/i.exec(x)))return prefixes(splitTop(m[1]).flatMap(flat));
        if((m=/^CUBE\s*\(([\s\S]*)\)$/i.exec(x)))return subsets(splitTop(m[1]).flatMap(flat));
        if((m=/^GROUPING\s+SETS\s*\(([\s\S]*)\)$/i.exec(x)))return splitTop(m[1]).map(s=>s.trim()).filter(s=>s!=='').map(flat);
        return [[x]];});
      if(withRollup){const all=opts.map(o=>o[0][0]);opts.length=0;opts.push(prefixes(all));}
      let sets=[[]];for(const o of opts)sets=sets.flatMap(a=>o.map(b=>a.concat(b.filter(c=>!a.some(d=>nrm(d)===nrm(c))))));
      const tous=[];sets.flat().forEach(c=>{if(!tous.some(d=>nrm(d)===nrm(c)))tous.push(c);});
      const items=splitTop(selList).map(x=>x.trim());
      const alias=x=>{const a=/\s(?:AS\s+)?("[^"]*"|[A-Za-z_]\w*|\u0001\d+\u0002)$/i.exec(x);return a&&!/^(END|NULL)$/i.test(a[1])?a[1]:null;};
      const branche=(S,premiere)=>{
        const abs=tous.filter(c=>!S.some(s=>nrm(s)===nrm(c)));
        const sl=items.map(x=>{const y=sansCols(x,abs,S);if(!premiere||y===x||alias(x))return y;
          const nom=/(?:^|\.)([A-Za-z_]\w*)$/.exec(x)?/(?:^|\.)([A-Za-z_]\w*)$/.exec(x)[1]:x.replace(/"/g,'""');return `${y} AS "${nom}"`;}).join(', ');
        return `SELECT ${distinct}${sl} ${fromTxt}${S.length?'GROUP BY '+S.join(', ')+' ':''}${havTxt!==null?'HAVING '+sansCols(havTxt,abs,S)+' ':''}`.replace(/\s+$/,'');};
      let ord='';
      if(ordTxt!==null){
        ord=' ORDER BY '+splitTop(ordTxt).map(o=>{const m=/^\s*([\s\S]*?)(\s+(?:ASC|DESC)\b[\s\S]*|\s+NULLS\s+(?:FIRST|LAST)\s*)?$/i.exec(o);const ex=m[1].trim(),dir=m[2]||'';
          if(/^\d+$/.test(ex))return ex+dir;
          const k=items.findIndex(x=>{const a=alias(x);return nrm(x)===nrm(ex)||(a&&nrm(a.replace(/"/g,''))===nrm(ex.replace(/"/g,'')))||nrm(x.replace(/\s(?:AS\s+)?("[^"]*"|[A-Za-z_]\w*)$/i,''))===nrm(ex);});
          const nulls=/NULLS/i.test(dir)?'':/DESC/i.test(dir)?' NULLS FIRST':' NULLS LAST';   // comme PostgreSQL : la ligne « total » (NULL) en dernier
          return (k>=0?String(k+1):ex)+dir+nulls;}).join(', ');
      }
      return prefix+sets.map((S,i)=>branche(S,i===0)).join(' UNION ALL ')+ord+(limTxt?' '+limTxt:'');
    }).join(';');
  }
  return t.replace(/\u0001(\d+)\u0002/g,(m,i)=>keep[+i]);
}
function attachSqlFn(database,name,fn,variadic){
  if(!database||typeof database.create_function!=='function') return;
  let f=fn;
  if(variadic){f=(...args)=>fn(...args);try{Object.defineProperty(f,'length',{value:-1});}catch(e){}}   // nombre d’arguments libre
  try{database.create_function(name,f);}catch(e){}
}
function attachDateFns(database){
  if(!database||typeof database.create_function!=='function') return database;
  /* Les écritures des autres SGBD sont réécrites pour SQLite avant chaque exécution */
  if(!database.__sqlCompat&&typeof database.exec==='function'&&typeof database.run==='function'){
    const exec=database.exec.bind(database),run=database.run.bind(database);
    database.exec=(q,p)=>exec(sqlCompat(q),p);
    database.run=(q,p)=>run(sqlCompat(q),p);
    database.__sqlCompat=true;
  }
  for(const [name,fn] of Object.entries(SQLX.fixed)) attachSqlFn(database,name,fn);
  for(const [name,fn] of Object.entries(SQLX.variadic)) attachSqlFn(database,name,fn,true);
  if(typeof database.create_aggregate==='function'){
    for(const [name,a] of Object.entries(SQLX.aggregate)){
      let step=a.step;
      if(a.variadic){step=(...args)=>a.step(...args);try{Object.defineProperty(step,'length',{value:0});}catch(e){}}
      try{database.create_aggregate(name,{init:a.init,step,finalize:a.finalize});}catch(e){}
    }
  }
  return database;
}

export {attachDateFns,sqlCompat};
