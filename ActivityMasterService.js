/* Owner-run schema upgrade and read-only activity option/preview service. */
function upgrade16(){
 owner09_();if(typeof ActivityMaster==='undefined'||typeof request14_==='undefined')throw Error('Save ActivityMaster.gs and keep the existing Performance.gs before running upgrade16');
 var lock=LockService.getScriptLock();lock.waitLock(20000);try{var p=PropertiesService.getScriptProperties(),journal=events_(true);if(!Array.isArray(Sense.replay(journal).activityRules))throw Error('Replace Domain.gs with the supplied 0.16 file before running upgrade16');if(!p.getProperty('BACKUP_16_ID')){var file=DriveApp.getFileById(db_().getId()).makeCopy('XEN Sense — Before Activity Master 0.16 — '+today_());p.setProperty('BACKUP_16_ID',file.getId());console.log('Backup: '+file.getUrl());}refreshAllViews11_();p.setProperty('SCHEMA_VERSION','0.16');console.log('Activity Master Rules ready. Existing tasks, rules, access templates and triggers retained. No rules were frozen automatically. '+db_().getUrl());}finally{lock.releaseLock();}
}
function activityOptions16_(req,u){
 var s=Sense.replay(events_()),v=req.values||{},now=now_();ActivityMaster.norm(s);if(v.date){if(u.role!=='XEN')throw Error('Only XEN may preview another date');ActivityMaster.date(v.date);now=v.date+'T06:30:00Z';}
 return ActivityMaster.options(s,u,v,now);
}
