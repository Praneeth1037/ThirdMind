import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const evidence={input:'Socrates, what do you think?',audioFile:'artifacts/native-speech/microphone.wav',recognition:[],synthesis:[],pageErrors:[]};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false,ignoreDefaultArgs:['--mute-audio'],args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${resolve(evidence.audioFile)}%noloop`]});
try {
 const context=await browser.newContext({permissions:['microphone','camera'],viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',error=>evidence.pageErrors.push(error.message));
 await page.addInitScript(()=>{
  window.nativeVoiceProbe={recognition:[],synthesis:[]};
  const Recognition=window.SpeechRecognition??window.webkitSpeechRecognition;
  if(Recognition){
   const original=Recognition.prototype.start,seen=new WeakSet();
   Recognition.prototype.start=function(...args){
    if(!seen.has(this)){
     seen.add(this);
     for(const name of ['start','audiostart','soundstart','speechstart','speechend','end'])this.addEventListener(name,()=>window.nativeVoiceProbe.recognition.push({event:name,at:Date.now()}));
     this.addEventListener('error',event=>window.nativeVoiceProbe.recognition.push({event:'error',error:event.error,at:Date.now()}));
     this.addEventListener('result',event=>{for(let i=event.resultIndex;i<event.results.length;i++)window.nativeVoiceProbe.recognition.push({event:'result',text:event.results[i][0].transcript,final:event.results[i].isFinal,at:Date.now()});});
    }
    return original.apply(this,args);
   };
  }
  if(window.speechSynthesis){const original=window.speechSynthesis.speak.bind(window.speechSynthesis);window.speechSynthesis.speak=utterance=>{
   for(const name of ['start','end','boundary'])utterance.addEventListener(name,event=>window.nativeVoiceProbe.synthesis.push({event:name,text:utterance.text,charIndex:event.charIndex,at:Date.now()}));
   utterance.addEventListener('error',event=>window.nativeVoiceProbe.synthesis.push({event:'error',error:event.error,text:utterance.text,at:Date.now()}));
   return original(utterance);
  };}
 });
 await page.goto('http://localhost:3000');
 await page.getByRole('button',{name:/The ethics study group/}).click();
 await page.getByLabel('Your display name').fill('Native voice test');
 await page.getByRole('button',{name:'Create conversation',exact:true}).click();
 await page.getByRole('button',{name:'Start call',exact:true}).click();
 await page.waitForSelector('.call-status');
 evidence.roomUrl=page.url();
 console.log('Opened actual Chrome app and connected to the local call. Testing native speaker output.');
 await page.getByRole('button',{name:'Test speaker',exact:true}).click();
 await page.waitForFunction(()=>window.nativeVoiceProbe.synthesis.some(e=>e.event==='end'||e.event==='error'),{},{timeout:25000}).catch(()=>{});
 console.log('Enabling native speech recognition with generated spoken microphone audio.');
 await page.getByRole('button',{name:'Enable Voice Minds',exact:true}).click();
 await page.waitForFunction(()=>window.nativeVoiceProbe.recognition.some(e=>e.event==='error'||e.event==='result'&&e.final),{},{timeout:30000}).catch(()=>{});
 await page.waitForTimeout(2500);
 const probe=await page.evaluate(()=>window.nativeVoiceProbe);Object.assign(evidence,probe);
 evidence.aiMessages=await page.locator('.ai-message .message-body p').allTextContents();
 evidence.visibleSpeechError=await page.locator('.voice-error').allTextContents();
 evidence.visiblePlaybackError=await page.locator('.room-error').allTextContents();
 evidence.captionText=await page.locator('.caption-log').innerText();
 evidence.voiceStatus=await page.locator('.voice-minds-heading strong').innerText();
 await page.screenshot({path:'artifacts/native-speech/native-browser-result.png',fullPage:true});
 if(evidence.aiMessages.length){await page.waitForFunction(()=>window.nativeVoiceProbe.synthesis.filter(e=>e.event==='end').length>=2,{},{timeout:30000}).catch(()=>{});Object.assign(evidence,await page.evaluate(()=>window.nativeVoiceProbe));}
 console.log(JSON.stringify(evidence,null,2));
} catch(error){evidence.testError=error.message;console.log(JSON.stringify({error:error.message}));}
finally{await writeFile('artifacts/native-speech/result.json',JSON.stringify(evidence,null,2));await browser.close();}
