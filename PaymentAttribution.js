/* 0.21.1 — causal cash attribution. Never spreads an old refund over future receipts. */
var PaymentAttribution=(function(){
 function a(v,m){if(!v)throw Error(m);}
 function integer(v){a(Number.isSafeInteger(v)&&v>=0,'Invalid payment attribution amount');return v;}
 function pair(p){return p.payerId+'|'+p.payeeId;}
 function time(v){var n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
 function confirmedAt(p){return time(p.reviewedAt||p.createdAt||p.date);}
 function calculate(s){
  var payments={},orders={},lots={},slices=[],events=[],byOrder={},byAllocation={},byPayment={},warnings=[],trace=[],totals={};
  (s.orders||[]).forEach(function(o){orders[o.id]=o;});
  (s.payments||[]).forEach(function(p,i){payments[p.id]=p;if(p.status!=='Confirmed')return;integer(p.amount);var totalKey=p.type+'|'+pair(p);totals[totalKey]=(totals[totalKey]||0)+p.amount;a(Number.isSafeInteger(totals[totalKey]),'Payment total exceeds the supported exact integer range');events.push({kind:p.type==='Refund'?'refund':'payment',p:p,at:confirmedAt(p),index:i});});
  (s.paymentAllocations||[]).forEach(function(al,i){var p=payments[al.paymentId],o=orders[al.orderId];if(!p||p.status!=='Confirmed'||p.type==='Refund'||!o||p.payerId!==o.buyerId||p.payeeId!==o.sellerId)return;integer(al.amount);events.push({kind:'allocation',al:al,p:p,at:Math.max(time(al.at),confirmedAt(p)),index:i});});
  var rank={payment:0,allocation:1,refund:2};events.sort(function(x,y){return x.at-y.at||rank[x.kind]-rank[y.kind]||x.index-y.index;});
  function take(lot,n,refund,allocation){var used=Math.min(n,allocation?allocation.amount:lot.free);if(!used)return 0;if(allocation)allocation.amount-=used;else lot.free-=used;lot.refunded+=used;trace.push({refundId:refund.id,paymentId:lot.id,orderId:allocation?allocation.orderId:'',amount:used,method:refund.refundPaymentId?'Original payment':refund.orderId?'Order':'Legacy FIFO'});return used;}
  events.forEach(function(e){var p=e.p;
   if(e.kind==='payment'){lots[p.id]={id:p.id,pair:pair(p),free:p.amount,refunded:0,at:e.at,index:e.index};return;}
   if(e.kind==='allocation'){var lot=lots[p.id],wanted=e.al.amount,q=lot?Math.min(lot.free,wanted):0;if(q){lot.free-=q;slices.push({allocationId:e.al.id,paymentId:p.id,orderId:e.al.orderId,amount:q,at:e.at,index:e.index});}if(q<wanted)warnings.push({kind:'Allocation exceeds available cash',paymentId:p.id,orderId:e.al.orderId,amount:wanted-q});return;}
   var remaining=p.amount,key=p.payeeId+'|'+p.payerId,source=p.refundPaymentId&&lots[p.refundPaymentId],candidates=Object.keys(lots).map(function(id){return lots[id];}).filter(function(l){return l.pair===key&&(!p.refundPaymentId||l.id===p.refundPaymentId);}).sort(function(x,y){return x.at-y.at||x.index-y.index;});
   if(p.refundPaymentId&&(!source||source.pair!==key)){warnings.push({kind:'Refund source unavailable at confirmation',refundId:p.id,amount:remaining});return;}
   if(p.orderId){slices.filter(function(x){return x.orderId===p.orderId&&candidates.some(function(l){return l.id===x.paymentId;});}).forEach(function(x){remaining-=take(lots[x.paymentId],remaining,p,x);});}
   candidates.forEach(function(l){remaining-=take(l,remaining,p,null);});
   if(!p.orderId)slices.filter(function(x){return candidates.some(function(l){return l.id===x.paymentId;});}).sort(function(x,y){return x.at-y.at||x.index-y.index;}).forEach(function(x){remaining-=take(lots[x.paymentId],remaining,p,x);});
   if(!p.refundPaymentId&&!p.orderId)warnings.push({kind:'Legacy refund uses unused cash then earlier allocations (FIFO)',refundId:p.id,amount:p.amount-remaining});
   if(remaining)warnings.push({kind:'Refund has no matching recorded cash; review opening credit / source',refundId:p.id,orderId:p.orderId||'',amount:remaining});
  });
  slices.forEach(function(x){byOrder[x.orderId]=integer((byOrder[x.orderId]||0)+x.amount);byAllocation[x.allocationId]=integer((byAllocation[x.allocationId]||0)+x.amount);});
  Object.keys(lots).forEach(function(id){var l=lots[id];byPayment[id]={available:integer(l.free),refunded:integer(l.refunded),allocated:integer(slices.filter(function(x){return x.paymentId===id;}).reduce(function(n,x){return n+x.amount;},0))};});
  return {byOrder:byOrder,byAllocation:byAllocation,byPayment:byPayment,warnings:warnings,trace:trace};
 }
 function validateSource(s,refund,ignoreId){
  a(refund.type==='Refund','Only a refund may link an original payment');a(!(refund.refundPaymentId&&refund.orderId),'Choose an original payment OR an order, not both');
  if(refund.refundPaymentId){var p=(s.payments||[]).find(function(p){return p.id===refund.refundPaymentId;});a(p&&p.status==='Confirmed'&&p.type!=='Refund'&&p.payerId===refund.payeeId&&p.payeeId===refund.payerId,'Select a confirmed original payment between these same parties');var used=(s.payments||[]).filter(function(x){return x.id!==ignoreId&&x.type==='Refund'&&x.refundPaymentId===p.id&&!['Rejected','Reversed'].includes(x.status);}).reduce(function(n,x){return n+x.amount;},0);a(used+refund.amount<=p.amount,'Linked refunds exceed the original payment');if(refund.status==='Confirmed')a(!confirmedAt(p)||!confirmedAt(refund)||confirmedAt(p)<=confirmedAt(refund),'Original payment was confirmed after this refund');}
  if(refund.orderId){var o=(s.orders||[]).find(function(o){return o.id===refund.orderId;});a(o&&o.buyerId===refund.payeeId&&o.sellerId===refund.payerId,'Refund order must belong to these same parties');}
 }
 return {calculate:calculate,validateSource:validateSource};
})();
function upgradeCommissionFix211(){owner09_();if(typeof Notifications==='undefined'||typeof PaymentAttribution==='undefined')throw Error('Keep Notifications 0.21 and save PaymentAttribution.gs first');var lock=LockService.getScriptLock();lock.waitLock(20000);try{var p=PropertiesService.getScriptProperties(),s=Sense.replay(events_(true));PaymentAttribution.calculate(s);if(!p.getProperty('BACKUP_COMMISSION_211_ID')){var b=DriveApp.getFileById(db_().getId()).makeCopy('XEN Sense — Before commission correction 0.21.1 — '+today_());p.setProperty('BACKUP_COMMISSION_211_ID',b.getId());console.log('Backup: '+b.getUrl());}refreshAllViews11_();p.setProperty('COMMISSION_FIX_VERSION','0.21.1');console.log('Commission correction ready on Notifications 0.21. No ledger or commission entries rewritten, payouts sent or triggers changed. Review eligible amounts, then Recalculate earnings with a correction note.');}finally{lock.releaseLock();}}

