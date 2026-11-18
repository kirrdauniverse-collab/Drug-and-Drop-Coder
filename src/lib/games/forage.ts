// ===== ERDEI BARANGOLÁS – felfedezés és gombagyűjtés =====
import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, keyDown } from "./base";
import { drawBgPreset, makeStarfield } from "../backgrounds";
import { drawSprite } from "../sprites";

type Find = { x:number; y:number; kind:"mushroom"|"berry"|"herb"; name:string; points:number; poisonous:boolean; found:boolean; phase:number };

const FINDS: Omit<Find,"x"|"y"|"found"|"phase">[] = [
  {kind:"mushroom",name:"Vargánya",points:20,poisonous:false},
  {kind:"mushroom",name:"Rókagomba",points:15,poisonous:false},
  {kind:"mushroom",name:"Gyilkos galóca",points:-15,poisonous:true},
  {kind:"mushroom",name:"Őzlábgomba",points:18,poisonous:false},
  {kind:"mushroom",name:"Tintagomba",points:8,poisonous:false},
  {kind:"berry",name:"Erdei szamóca",points:8,poisonous:false},
  {kind:"berry",name:"Áfonya",points:10,poisonous:false},
  {kind:"herb",name:"Gyógynövény",points:12,poisonous:false},
];

export class ForageGame implements GameMode {
  private ctx:GameCtx; private target:number; private finds:Find[]=[]; private px=50; private py=52;
  private inventory:string[]=[]; private message="Mozogj a WASD vagy a nyilak segítségével, és kattints a közelben talált kincsekre!";
  private messageAt=0; private time=0; private done=false; private over=false; private stars=makeStarfield();
  private speed=22; private goal:number; private score=0;
  constructor(pr:Record<string,string|number|boolean>,ctx:GameCtx){
    this.ctx=ctx;this.target=Number(pr.target??-1);this.goal=clamp(Math.round(Number(pr.goal??8)),3,20);
    const count=clamp(Math.round(Number(pr.items??14)),6,28);
    for(let i=0;i<count;i++){const f=FINDS[Math.floor(Math.random()*FINDS.length)];this.finds.push({...f,x:8+Math.random()*84,y:24+Math.random()*65,found:false,phase:Math.random()*6.28});}
    this.messageAt=performance.now();ctx.emit("Erdei barangolás indul – gyűjtsd össze a keresett terméseket!","logic");
  }
  isDone(){return this.done;}
  click(x:number,y:number,now:number){
    if(this.over)return;
    let best:Find|undefined,dist=Infinity;
    for(const f of this.finds){if(f.found)continue;const d=Math.hypot((f.x-x)*GW/100,(f.y-y)*GH/100);if(d<dist){dist=d;best=f;}}
    if(!best||dist>78){this.say("Menj közelebb a növényhez, mielőtt felszeded!",now);return;}
    best.found=true;
    if(best.poisonous){this.ctx.loseLife();this.ctx.sfx("sfx.hurt",.7);this.say("Vigyázat! Mérgező gombát találtál: "+best.name,now);this.ctx.emit("Mérgező találat: "+best.name,"warn");}
    else{this.inventory.push(best.name);this.score+=best.points;this.ctx.addScore(best.points);this.ctx.sfx("sfx.powerup",.55);this.ctx.burst(best.x/100*GW,best.y/100*GH,12,"#a3e635",130);this.say("Megtaláltad: "+best.name+" (+"+best.points+" pont)",now);this.ctx.emit("Begyűjtve: "+best.name,"logic");}
    if(this.inventory.length>=this.goal){this.over=true;this.say("Sikeres gyűjtögetés! Megvan a napi zsákmány.",now);setTimeout(()=>{this.done=true;this.ctx.finish(true,"Sikeres erdei barangolás! "+this.inventory.length+" termést gyűjtöttél.",this.target);},650);}
  }
  private say(s:string,now:number){this.message=s;this.messageAt=now;}
  update(dt:number,now:number){
    if(this.over)return;this.time+=dt;
    const k=this.ctx.keys;let dx=0,dy=0;
    if(keyDown(k,"a","ArrowLeft"))dx--;if(keyDown(k,"d","ArrowRight"))dx++;
    if(keyDown(k,"w","ArrowUp"))dy--;if(keyDown(k,"s","ArrowDown"))dy++;
    if(dx||dy){const n=Math.hypot(dx,dy);this.px=clamp(this.px+dx/n*this.speed*dt,4,96);this.py=clamp(this.py+dy/n*this.speed*dt,20,92);}
    if(now-this.messageAt>6500)this.message="";
    if(this.ctx.lives()<=0){this.over=true;this.done=true;this.ctx.finish(false,"Elfáradtál az erdőben – elfogytak az életeid.",this.target);}
  }
  render(ctx:CanvasRenderingContext2D,now:number){
    drawBgPreset(ctx,"forest",now,this.stars);
    // erdei talaj és ösvény
    ctx.fillStyle="rgba(20,45,24,.22)";ctx.fillRect(0,GH*.22,GW,GH*.78);
    ctx.strokeStyle="rgba(214,180,120,.28)";ctx.lineWidth=34;ctx.beginPath();ctx.moveTo(0,GH*.82);ctx.bezierCurveTo(GW*.3,GH*.62,GW*.65,GH*.95,GW,GH*.58);ctx.stroke();
    for(const f of this.finds){if(f.found)continue;const x=f.x/100*GW,y=f.y/100*GH;const bob=Math.sin(now/400+f.phase)*2;
      ctx.save();ctx.translate(x,y+bob);
      if(f.kind==="mushroom")drawSprite(ctx,"mushroom",{size:26,color:f.poisonous?"#dc2626":"#f59e0b",now,id:f.phase,poly:[]});
      else if(f.kind==="berry")drawSprite(ctx,"gem",{size:20,color:"#7c3aed",now,id:f.phase,poly:[]});
      else drawSprite(ctx,"flower",{size:21,color:"#4ade80",now,id:f.phase,poly:[]});
      ctx.restore();
    }
    // játékos jelölő
    ctx.save();ctx.translate(this.px/100*GW,this.py/100*GH);drawSprite(ctx,"robot",{size:34,color:"#38bdf8",now,id:3,poly:[]});ctx.restore();
    // fejléc és cél
    ctx.fillStyle="rgba(9,20,12,.78)";ctx.fillRect(0,0,GW,48);
    ctx.fillStyle="#d9f99d";ctx.font="800 22px Geist,system-ui,sans-serif";ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText("ERDEI BARANGOLÁS",18,24);
    ctx.textAlign="right";ctx.fillStyle="#fef3c7";ctx.font="600 17px Geist,system-ui,sans-serif";ctx.fillText("Begyűjtve: "+this.inventory.length+" / "+this.goal,GW-18,24);
    // leltár
    ctx.fillStyle="rgba(9,20,12,.82)";ctx.fillRect(12,GH-48,GW-24,36);
    ctx.fillStyle="#d9f99d";ctx.font="600 14px Geist,system-ui,sans-serif";ctx.textAlign="left";
    ctx.fillText("Leltár: "+(this.inventory.slice(-8).join(" · ")||"még üres"),24,GH-30);
    if(this.message){ctx.fillStyle="rgba(9,20,12,.88)";ctx.fillRect(90,GH-112,GW-180,48);ctx.strokeStyle="rgba(190,242,100,.6)";ctx.strokeRect(90,GH-112,GW-180,48);ctx.fillStyle="#f0fdf4";ctx.font="600 17px Geist,system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(this.message,GW/2,GH-88, GW-220);}
    ctx.fillStyle="rgba(9,20,12,.62)";ctx.fillRect(GW-252,58,236,28);ctx.fillStyle="#d1fae5";ctx.font="12px Geist,system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("WASD / nyilak: mozgás · kattintás: gyűjtés",GW-134,72);
  }
}
