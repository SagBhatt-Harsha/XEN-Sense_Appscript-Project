/* Performance 0.14. Request-local reuse only; no shared user/state caches. */
var request14_=null;
function requestSecret14_(){if(request14_&&request14_.secret)return request14_.secret;var s=PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');if(!s)throw Error('Run install first.');if(request14_)request14_.secret=s;return s;}
function verifiedState14_(journal){if(request14_&&request14_.stateJournal===journal&&request14_.state)return request14_.state;var s=Sense.replay(journal);if(request14_){request14_.stateJournal=journal;request14_.state=s;}return s;}
function committed14_(event,journal,payload,signature){if(!request14_)return;var saved=JSON.parse(payload);saved.signature=signature;request14_.events=journal.concat([saved]);request14_.state=null;request14_.stateJournal=null;request14_.commits++;}
function markWrite14_(){if(request14_)request14_.writeRequest=true;}
function api(req){
 var previous=request14_,started=Date.now();request14_={events:null,state:null,stateJournal:null,secret:'',db:null,commits:0,writeRequest:false,userId:'',stats:{journalReads:0,journalRows:0,viewRowsWritten:0,viewRebuilds:0}};
 try{var result=apiCore14_(req);if(result&&result.ok&&req&&req.wantBootstrap===true&&request14_.userId&&(request14_.commits||request14_.writeRequest)){
   try{var journal=events_(),s=verifiedState14_(journal),u=s.members.find(function(m){return m.id===request14_.userId&&m.active;});if(u)result.bootstrap=bootstrap_(s,u,journal);}catch(refreshError){console.log('Saved; refresh will use the normal reload: '+String(refreshError.message||refreshError).slice(0,200));}
  }
  if(result&&result.ok&&req&&req.wantPerformance===true&&request14_.userId){var state=verifiedState14_(events_()),member=state.members.find(function(m){return m.id===request14_.userId&&m.active;});if(member&&member.role==='XEN')result.performance=Object.assign({elapsedMs:Date.now()-started},request14_.stats);}
  return result;
 }finally{request14_=previous;}
}
function viewColumns14_(records){var cols=['id'];records.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k);});});return cols;}
function viewCells14_(record,cols){return cols.map(function(k){var x=record[k];x=x==null?'':typeof x==='object'?JSON.stringify(x):String(x);return /^[=+@-]/.test(x)?"'"+x:x;});}
function writeChangedView14_(table,records,ids){
 var name='View_'+(table==='changeRequests'?'Changes':table.charAt(0).toUpperCase()+table.slice(1)),sh=db_().getSheetByName(name),cols=viewColumns14_(records);
 function rebuild(){writeView11_(table,records);}
 if(!sh||typeof sh.getLastColumn!=='function')return rebuild();
 var last=sh.getLastRow(),width=sh.getLastColumn();if(!last||width!==cols.length)return rebuild();
 var header=sh.getRange(1,1,1,width).getValues()[0].map(String);if(JSON.stringify(header)!==JSON.stringify(cols)||last>records.length+1)return rebuild();
 var existing=last>1?sh.getRange(2,1,last-1,1).getValues():[];
 for(var i=0;i<existing.length;i++)if(!records[i]||String(existing[i][0])!==String(records[i].id))return rebuild();
 if(sh.getMaxRows()<records.length+1)sh.insertRowsAfter(sh.getMaxRows(),records.length+1-sh.getMaxRows());
 var wanted={};ids.forEach(function(id){wanted[id]=true;});var pending=[];
 records.forEach(function(r,i){if(wanted[r.id]||i>=existing.length)pending.push({row:i+2,cells:viewCells14_(r,cols)});});
 for(var at=0;at<pending.length;){var end=at+1;while(end<pending.length&&pending[end].row===pending[end-1].row+1)end++;var batch=pending.slice(at,end);sh.getRange(batch[0].row,1,batch.length,cols.length).setNumberFormat('@').setValues(batch.map(function(r){return r.cells;}));if(request14_)request14_.stats.viewRowsWritten+=batch.length;at=end;}
 sh.getRange(1,1).setNote('Automatic projection of signed Events. Edit through XEN Sense. Updated '+now_());
}
function syncViews14_(event,events){var journal=request14_&&request14_.events||events.concat([event]),s=verifiedState14_(journal),p=PropertiesService.getScriptProperties();if(p.getProperty('VIEWS_DIRTY_11'))return refreshAllViews11_(s);var tables=Array.from(new Set(event.changes.map(function(c){return c.table;})));tables.forEach(function(t){writeChangedView14_(t,s[t],event.changes.filter(function(c){return c.table===t;}).map(function(c){return c.record.id;}));});p.setProperty('VIEWS_AT_11',now_());p.deleteProperty('VIEWS_DIRTY_11');}
function upgrade14(){owner09_();var lock=LockService.getScriptLock();lock.waitLock(20000);try{var p=PropertiesService.getScriptProperties();events_(true);if(!p.getProperty('BACKUP_14_ID')){var file=DriveApp.getFileById(db_().getId()).makeCopy('XEN Sense — Before Performance 0.14 — '+today_());p.setProperty('BACKUP_14_ID',file.getId());console.log('Backup: '+file.getUrl());}refreshAllViews11_();p.setProperty('SCHEMA_VERSION','0.14');console.log('Performance 0.14 ready. Same signed journal, business rules and automatic-sync setting. Existing triggers unchanged. '+db_().getUrl());}finally{lock.releaseLock();}}
