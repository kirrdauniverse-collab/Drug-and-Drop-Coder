// ===== STAR RAID: Deluxe Galaga ihlette arcade lövölde =====
import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, keyDown, drawBtn, drawChip, inRect } from "./base";
import { drawBgPreset, makeStarfield } from "../backgrounds";
import { drawSprite } from "../sprites";

type Enemy={x:number;y:number;vx:number;hp:number;size:number;phase:number;boss?:boolean;maxHp?:number};
type Shot={x:number;y:number;vy:number;friendly:boolean};
type Drop={x:number;y:number;vy:number;kind:"cash"|"weapon"|"speed"|"armour"|"life";value:number};
type Rock={x:number;y:number;vx:number;vy:number;r:number;phase:number};

export class GalagaGame implements GameMode {
  private ctx:GameCtx; private target:number; private phase:"combat"|"shop"|"meteor"|"memory"|"done"="combat";
  private player=GW/2; private playerSpeed=330; private shots:Shot[]=[]; private enemies:Enemy[]=[]; private drops:Drop[]=[];
  private rocks:Rock[]=[]; private stars=makeStarfield(); private level=1; private wave=0; private cash=0; private weapon=1; private armour=0; private lives=3;
  private fireClock=0; private spawnClock=0; private phaseClock=0; private invuln=0; private score=0; private message="Lődd le az ellenséges hullámot!"; private messageTime=0;
  private shopItems=[{name:"Dupla lövés",cost:100,kind:"weapon"},{name:"Gyorsabb hajó",cost:75,kind:"speed"},{name:"Páncél",cost:150,kind:"armour"},{name:"Extra élet",cost:250,kind:"life"}];
  private memoryCards:number[]=[]; private memoryOpen:number[]=[]; private memoryMatched:Set<number>=new Set(); private memoryClock=0; private memoryWait=0;
  private bonusAfterShop=false; private done=false;
  constructor(p:Record<string,string|number|boolean>,ctx:GameCtx){this.ctx=ctx;this.target=Number(p.target??-1);this.lives=ctx.lives();this.startWave();ctx.emit("STAR RAID: indul az első ellenséges hullám!","logic");}
  isDone(){return this.done;}
  private say(s:string,now:number){this.message=s;this.messageTime=now;}
  private startWave(now=performance.now()){
    this.phase="combat";this.enemies=[];this.shots=[];this.drops=[];this.spawnClock=0;
    // Minden ötödik hullám végén főellenség várja a játékost.
    if(this.wave>0&&this.wave%5===4){
      const hp=12+this.level*2;
      this.enemies.push({x:GW/2,y:112,vx:72+this.level*2,hp,maxHp:hp,size:92,phase:0,boss:true});
      this.say("FŐELLENSÉG KÖZELEDIK! Célozz a közepére!",now);
      return;
    }
    const n=Math.min(18,5+this.level*2);
    for(let i=0;i<n;i++){const cols=Math.min(6,n);this.enemies.push({x:100+(i%cols)*145,y:95+Math.floor(i/cols)*58,vx:35+this.level*2,hp:this.level>5&&i%5===0?2:1,size:i%5===0?42:30,phase:i*1.7});}
  }
  private nextStage(now:number){this.wave++;this.level++;this.say("Hullám teljesítve!",now);this.ctx.addScore(150+this.wave*20);this.ctx.sfx("sfx.win",.45);
    if(this.wave%4===0){this.phase="shop";this.bonusAfterShop=this.wave%3===0;this.say("ŰRBOLT – költsd el a krediteket!",now);}
    else if(this.wave%3===0){this.startBonus(now);}
    else this.startWave();
  }
  private startBonus(now:number){if(this.wave%2===0){this.phase="memory";this.memoryCards=[0,1,2,3,0,1,2,3].sort(()=>Math.random()-.5);this.memoryOpen=[];this.memoryMatched.clear();this.memoryClock=18;this.memoryWait=0;this.say("MEMÓRIAÁLLOMÁS – találj párokat!",now);}
    else{this.phase="meteor";this.phaseClock=14;this.rocks=[];for(let i=0;i<8;i++)this.rocks.push({x:Math.random()*GW,y:-Math.random()*GH,vx:(Math.random()-.5)*80,vy:100+Math.random()*120,r:18+Math.random()*24,phase:i});this.say("METEORVIHAR – kerüld ki a sziklákat!",now);}}
  update(dt:number,now:number){
    if(this.done)return;const k=this.ctx.keys;
    if(this.phase==="combat"){
      const dx=(keyDown(k,"ArrowRight","d")?1:0)-(keyDown(k,"ArrowLeft","a")?1:0);this.player=clamp(this.player+dx*this.playerSpeed*dt,32,GW-32);
      this.fireClock-=dt;if(keyDown(k," ","ArrowUp","w")&&this.fireClock<=0){this.fireClock=Math.max(.12,.34-this.weapon*.045);const shotCount=this.weapon>=4?4:this.weapon>=3?3:this.weapon>=2?2:1;
        for(let i=0;i<shotCount;i++)this.shots.push({x:this.player+(i-(shotCount-1)/2)*14,y:GH-78,vy:-510,friendly:true});this.ctx.sfx("sfx.shoot",.16);}
      this.spawnClock+=dt;
      for(const e of this.enemies){
        if(e.boss){e.x+=e.vx*dt;if(e.x<115||e.x>GW-115)e.vx*=-1;e.y=112+Math.sin(now/430)*20;
          if(Math.random()<dt*.95){for(const offset of [-30,0,30])this.shots.push({x:e.x+offset,y:e.y+30,vy:205+this.level*6+Math.abs(offset),friendly:false});}
        }else{e.x+=Math.sin(now/700+e.phase)*e.vx*dt;e.y+=Math.cos(now/850+e.phase)*8*dt;if(e.x<35||e.x>GW-35)e.vx*=-1;if(Math.random()<dt*.18)this.shots.push({x:e.x,y:e.y+18,vy:170+this.level*5,friendly:false});}
      }
      for(const s of this.shots)s.y+=s.vy*dt;this.shots=this.shots.filter(s=>s.y>-20&&s.y<GH+20);
      for(const s of this.shots){if(!s.friendly)continue;const hit=this.enemies.findIndex(e=>Math.hypot(e.x-s.x,e.y-s.y)<e.size*.55+5);if(hit>=0){const e=this.enemies[hit];e.hp--;s.y=-100;if(e.hp<=0){this.enemies.splice(hit,1);this.score+=100;this.ctx.addScore(100);if(e.boss){
              this.cash+=150;this.weapon=Math.min(4,this.weapon+1);
              this.ctx.addScore(500);this.say("FŐELLENSÉG LEGYŐZVE! +150 kredit és fegyverfejlesztés",now);
            }else if(Math.random()<.42){
              const roll=Math.random();
              const kind:Drop["kind"]=roll<.58?"cash":roll<.76?"weapon":roll<.9?"speed":roll<.97?"armour":"life";
              this.drops.push({x:e.x,y:e.y,vy:95,kind,value:kind==="cash"?25:1});
            }
            this.ctx.burst(e.x,e.y,e.boss?36:12,e.boss?"#c084fc":"#fb923c",e.boss?230:150);}}}
      for(const s of this.shots){if(s.friendly)continue;if(Math.abs(s.x-this.player)<24&&s.y>GH-95&&this.invuln<=0){this.hit(now);s.y=GH+50;}}
      for(const d of this.drops){d.y+=d.vy*dt;if(Math.abs(d.x-this.player)<30&&d.y>GH-105&&d.y<GH-45){if(d.kind==="cash"){this.cash+=d.value;this.say("+"+d.value+" kredit",now);}else if(d.kind==="weapon"){this.weapon=Math.min(4,this.weapon+1);this.say("Fegyverfejlesztés!",now);}else if(d.kind==="speed"){this.playerSpeed=Math.min(500,this.playerSpeed+25);this.say("Sebességnövelés!",now);}else if(d.kind==="armour"){this.armour=Math.min(4,this.armour+1);this.say("Páncél +1",now);}else this.addLife();this.ctx.sfx("sfx.powerup",.6);d.y=GH+100;}}
      this.drops=this.drops.filter(d=>d.y<GH+30);this.invuln=Math.max(0,this.invuln-dt);
      if(this.enemies.length===0)this.nextStage(now);
    }else if(this.phase==="meteor"){
      const dx=(keyDown(k,"ArrowRight","d")?1:0)-(keyDown(k,"ArrowLeft","a")?1:0);this.player=clamp(this.player+dx*(this.playerSpeed+80)*dt,32,GW-32);this.phaseClock-=dt;
      for(const r of this.rocks){r.x+=r.vx*dt;r.y+=r.vy*dt+Math.sin(now/250+r.phase)*20*dt;if(r.x<r.r||r.x>GW-r.r)r.vx*=-1;if(Math.hypot(r.x-this.player,r.y-(GH-72))<r.r+18){this.hit(now);r.y=GH+100;}}
      if(this.phaseClock<=0){this.cash+=100;this.ctx.addScore(1000);this.say("Meteorvihar teljesítve! +100 kredit",now);this.startWave();}
    }else if(this.phase==="memory"){
      this.memoryClock-=dt;if(this.memoryWait>0){this.memoryWait-=dt;if(this.memoryWait<=0){if(this.memoryOpen.length===2){const [a,b]=this.memoryOpen;if(this.memoryCards[a]!==this.memoryCards[b])this.memoryOpen=[];else{this.memoryMatched.add(a);this.memoryMatched.add(b);this.memoryOpen=[];this.cash+=25;this.ctx.addScore(200);}}}}
      if(this.memoryMatched.size===8||this.memoryClock<=0){this.say(this.memoryMatched.size===8?"Minden pár megvan! +100 kredit":"Lejárt az idő – a megtalált párok jutalma megmarad.",now);if(this.memoryMatched.size===8)this.cash+=100;this.startWave();}
    }
    if(this.message&&now-this.messageTime>4000)this.message="";
  }
  private addLife(){this.lives++;this.ctx.vars["lives"]=(this.ctx.vars["lives"]??(this.lives-1))+1;}
  private hit(now:number){if(this.invuln>0)return;if(this.armour>0){this.armour--;this.invuln=1.4;this.say("A páncél felfogta a találatot!",now);return;}this.lives--;const gameOver=this.ctx.loseLife();this.invuln=1.8;this.weapon=Math.max(1,this.weapon-1);this.ctx.sfx("sfx.hurt",.7);if(gameOver||this.lives<=0){this.done=true;this.phase="done";}}
  click(x:number,y:number,now:number){
    const px=x/100*GW,py=y/100*GH;
    if(this.phase==="shop"){for(let i=0;i<this.shopItems.length;i++){const yy=170+i*72;if(inRect(px,py,250,yy,460,54)){const item=this.shopItems[i];if(this.cash<item.cost){this.say("Nincs elég kredited!",now);return;}this.cash-=item.cost;if(item.kind==="weapon")this.weapon=Math.min(4,this.weapon+1);if(item.kind==="speed")this.playerSpeed=Math.min(500,this.playerSpeed+35);if(item.kind==="armour")this.armour=Math.min(4,this.armour+1);if(item.kind==="life")this.addLife();this.say("Megvásárolva: "+item.name,now);return;}}
      if(inRect(px,py,360,475,240,46)){if(this.bonusAfterShop)this.startBonus(now);else this.startWave();}return;}
    if(this.phase==="memory"&&this.memoryWait<=0){const col=Math.floor((px-220)/130),row=Math.floor((py-150)/112),i=row*4+col;if(col>=0&&col<4&&row>=0&&row<2&&i>=0&&i<8&&!this.memoryMatched.has(i)&&!this.memoryOpen.includes(i)){this.memoryOpen.push(i);if(this.memoryOpen.length===2)this.memoryWait=.7;}}
  }
  render(ctx:CanvasRenderingContext2D,now:number){
    drawBgPreset(ctx,"space",now,this.stars);
    if(this.phase==="combat"||this.phase==="meteor"){
      if(this.phase==="combat"){for(const e of this.enemies){ctx.save();ctx.translate(e.x,e.y);drawSprite(ctx,"alien",{size:e.size,color:e.boss?"#c084fc":"#a3e635",now,id:e.phase});ctx.restore();}}
      if(this.phase==="meteor"){for(const r of this.rocks){ctx.save();ctx.translate(r.x,r.y);ctx.rotate(now/900+r.phase);drawSprite(ctx,"asteroid",{size:r.r*2,color:"#a8a29e",now,id:r.phase});ctx.restore();}}
      if(this.phase==="combat"){const boss=this.enemies.find(e=>e.boss);if(boss){ctx.fillStyle="rgba(15,23,42,.85)";ctx.fillRect(GW/2-190,58,380,14);ctx.fillStyle="#c084fc";ctx.fillRect(GW/2-188,60,376*(boss.hp/(boss.maxHp??boss.hp)),10);ctx.strokeStyle="#e9d5ff";ctx.lineWidth=1;ctx.strokeRect(GW/2-190,58,380,14);ctx.fillStyle="#f5d0fe";ctx.font="700 13px system-ui";ctx.textAlign="center";ctx.fillText("FŐELLENSÉG · "+boss.hp+" / "+boss.maxHp+" HP",GW/2,52);}}
      for(const s of this.shots){ctx.save();ctx.translate(s.x,s.y);drawSprite(ctx,"laser",{size:18,color:s.friendly?"#38bdf8":"#fb7185",now,id:s.y});ctx.restore();}
      for(const d of this.drops){ctx.save();ctx.translate(d.x,d.y);drawSprite(ctx,d.kind==="cash"?"coin":d.kind==="weapon"?"powerCore":d.kind==="speed"?"bolt":d.kind==="life"?"heart":"shield",{size:24,color:d.kind==="cash"?"#fbbf24":"#38bdf8",now,id:d.y});ctx.restore();}
      ctx.save();ctx.translate(this.player,GH-72);if(this.invuln<=0||Math.floor(now/90)%2===0)drawSprite(ctx,"ship",{size:42,color:"#38bdf8",now,id:1});ctx.restore();
    }
    if(this.phase==="shop"){ctx.fillStyle="rgba(4,10,30,.94)";ctx.fillRect(100,70,760,420);ctx.strokeStyle="#38bdf8";ctx.lineWidth=3;ctx.strokeRect(100,70,760,420);ctx.fillStyle="#e0f2fe";ctx.font="900 32px system-ui";ctx.textAlign="center";ctx.fillText("ŰRBOLT",480,120);ctx.font="18px system-ui";ctx.fillText("Kredit: "+this.cash,480,148);for(let i=0;i<this.shopItems.length;i++){const it=this.shopItems[i],yy=170+i*72;drawBtn(ctx,250,yy,460,54,it.name+"  –  "+it.cost+" kredit","#38bdf8",false,18);}drawBtn(ctx,360,475,240,46,"Tovább a következő hullámra","#a3e635",false,16);}
    if(this.phase==="memory"){ctx.fillStyle="rgba(4,10,30,.94)";ctx.fillRect(130,80,700,410);ctx.fillStyle="#e0f2fe";ctx.font="900 28px system-ui";ctx.textAlign="center";ctx.fillText("MEMÓRIAÁLLOMÁS",480,120);ctx.font="16px system-ui";ctx.fillText("Idő: "+Math.ceil(this.memoryClock)+" mp · Párok: "+this.memoryMatched.size/2,480,140);for(let i=0;i<8;i++){const x=220+(i%4)*130,y=160+Math.floor(i/4)*112,open=this.memoryOpen.includes(i)||this.memoryMatched.has(i);drawBtn(ctx,x,y,100,82,open?["★","◆","●","✦"][this.memoryCards[i]]:"?",open?"#a3e635":"#818cf8",false,28);}}
    ctx.fillStyle="rgba(3,7,18,.82)";ctx.fillRect(0,0,GW,46);ctx.fillStyle="#e0f2fe";ctx.font="700 17px system-ui";ctx.textAlign="left";ctx.fillText("STAR RAID  ·  Hullám "+(this.wave+1),18,29);ctx.textAlign="right";ctx.fillText("Élet: "+this.lives+"   Páncél: "+this.armour+"   Fegyver: "+this.weapon+"   Kredit: "+this.cash,GW-18,29);
    if(this.message){ctx.fillStyle="rgba(3,7,18,.82)";ctx.fillRect(160,GH-42,640,30);ctx.fillStyle="#fef3c7";ctx.font="600 15px system-ui";ctx.textAlign="center";ctx.fillText(this.message,GW/2,GH-22);}
    if(this.phase==="combat"||this.phase==="meteor"){ctx.fillStyle="#cbd5e1";ctx.font="13px system-ui";ctx.textAlign="center";ctx.fillText("A/D vagy ←/→: mozgás · SPACE: lövés",GW/2,GH-58);}
    if(this.phase==="meteor"){drawChip(ctx,"Meteorvihar: "+Math.ceil(this.phaseClock)+" mp",18,70,"#fbbf24");} if(this.phase==="combat"&&this.enemies.some(e=>e.boss)){drawChip(ctx,"FŐELLENSÉG",18,70,"#c084fc");}
  }
}
