function now_(){return new Date().toISOString();}
function today_(){return Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd');}
function uid_(p){return p+'-'+Utilities.getUuid();}
function hash_(s){var secret=typeof requestSecret14_==='function'?requestSecret14_():PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');if(!secret)throw Error('Run install first.');return Utilities.computeHmacSha256Signature(String(s),secret).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');}
function constant_(a,b){a=String(a);b=String(b);var d=a.length^b.length;for(var i=0;i<a.length;i++)d|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return d===0;}
function email_(v){var s=String(v||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)||s.length>200)throw Error('Enter a valid email address.');return s;}
function requestCode_(value){
  var email=email_(value),lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    var generic={message:'If this email belongs to an active member, a sign-in code has been sent.'};
    var member=rows_('Members').find(function(m){return m.email===email&&m.status==='Active';});if(!member)return generic;
    var props=PropertiesService.getScriptProperties(),key='otp:'+hash_(email),old=JSON.parse(props.getProperty(key)||'{}'),now=Date.now();
    if(old.sent&&now-old.sent<60000)return generic;
    var count=old.window&&now-old.window<3600000?Number(old.count||0):0;
    if(count>=5)return generic;
    var day=today_(),budget=JSON.parse(props.getProperty('OTP_DAILY_BUDGET')||'{}');if(budget.day!==day)budget={day:day,count:0};if(budget.count>=50)throw Error('Daily sign-in email limit reached. Please contact the administrator.');budget.count++;props.setProperty('OTP_DAILY_BUDGET',JSON.stringify(budget));
    if(MailApp.getRemainingDailyQuota()<1)throw Error('Sign-in email quota is exhausted. Please contact the administrator.');
    var code=String(parseInt(hash_(Utilities.getUuid()).slice(0,12),16)%1000000).padStart(6,'0');
    props.setProperty(key,JSON.stringify({hash:hash_(email+':'+code),expires:now+600000,attempts:0,sent:now,count:count+1,window:count?old.window:now}));
    MailApp.sendEmail({to:email,subject:'Your XEN Sense sign-in code',body:'Your sign-in code is '+code+'. It expires in 10 minutes. Do not share this code. If you did not request it, ignore this email.',name:'XEN Farms'});
    return generic;
  } finally {lock.releaseLock();}
}
function verifyCode_(value,code){
  var email=email_(value),lock=LockService.getScriptLock();lock.waitLock(10000);
  try {
    var props=PropertiesService.getScriptProperties(),key='otp:'+hash_(email),state=JSON.parse(props.getProperty(key)||'{}');
    if(!state.expires||Date.now()>state.expires||state.attempts>=5)throw Error('Code expired or attempts exceeded. Request a new code.');
    state.attempts++;props.setProperty(key,JSON.stringify(state));
    if(!/^\d{6}$/.test(String(code))||!constant_(state.hash,hash_(email+':'+code)))throw Error('Incorrect code.');
    var u=rows_('Members').find(function(m){return m.email===email&&m.status==='Active';});if(!u)throw Error('Access is inactive.');
    state.expires=0;props.setProperty(key,JSON.stringify(state));
    var token=Utilities.getUuid()+Utilities.getUuid();CacheService.getScriptCache().put('session:'+hash_(token),JSON.stringify({id:u.id,expires:Date.now()+3600000}),3600);return {token:token};
  } finally {lock.releaseLock();}
}
function authenticate_(token,journal){
  if(typeof token!=='string'||token.length<40||token.length>100)throw Error('Please sign in.');
  var s=CacheService.getScriptCache().get('session:'+hash_(token));if(!s)throw Error('Session expired. Please sign in again.');
  var v=JSON.parse(s);if(v.expires<Date.now())throw Error('Session expired. Please sign in again.');
  var u=rows_('Members',journal).find(function(m){return m.id===v.id&&m.status==='Active';});if(!u)throw Error('Your access has been deactivated.');if(typeof request14_!=='undefined'&&request14_)request14_.userId=u.id;return u;
}
