import {spawn} from 'node:child_process';

const state={status:'disabled',lastStartedAt:null,lastSucceededAt:null,lastFailedAt:null,error:null};

export function getBackupState(){return {...state};}

export function runBackup({logger=console}={}){
  if(state.status==='running')return Promise.resolve(false);
  state.status='running';state.lastStartedAt=new Date().toISOString();state.error=null;
  return new Promise(resolve=>{
    const child=spawn('sh',['scripts/backup-postgres.sh','/tmp/baan-pos-backups'],{env:process.env,stdio:['ignore','pipe','pipe']});
    let output='';
    child.stdout.on('data',chunk=>{output+=chunk.toString();});
    child.stderr.on('data',chunk=>{output+=chunk.toString();});
    child.on('error',error=>{state.status='failed';state.lastFailedAt=new Date().toISOString();state.error=error.message;logger.error(JSON.stringify({level:'error',event:'backup_failed',error:error.message}));resolve(false);});
    child.on('close',code=>{if(code===0){state.status='ok';state.lastSucceededAt=new Date().toISOString();state.error=null;logger.info(JSON.stringify({level:'info',event:'backup_succeeded'}));resolve(true);}else{state.status='failed';state.lastFailedAt=new Date().toISOString();state.error=output.slice(-1000)||`exit ${code}`;logger.error(JSON.stringify({level:'error',event:'backup_failed',code,error:state.error}));resolve(false);}});
  });
}

export function startBackupScheduler({logger=console}={}){
  if(process.env.BACKUP_ENABLED!=='1'){state.status='disabled';return null;}
  const interval=Math.max(3600000,Number(process.env.BACKUP_INTERVAL_MS||86400000));
  const firstDelay=Math.max(10000,Number(process.env.BACKUP_INITIAL_DELAY_MS||60000));
  const first=setTimeout(()=>runBackup({logger}),firstDelay);first.unref?.();
  const timer=setInterval(()=>runBackup({logger}),interval);timer.unref?.();
  state.status='scheduled';
  return {stop(){clearTimeout(first);clearInterval(timer);}};
}
