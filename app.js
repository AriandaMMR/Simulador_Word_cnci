(() => {
  const STORAGE = "realistic-word-simulator-v5-blank-rae";
  const $ = (id) => document.getElementById(id);
  const editor = $("editor"), page = $("page"), title = $("documentTitle"), backstage = $("backstage"), modal = $("modalDialog");
  const defaultHtml = ``;
  let zoom = 100, copiedFormat = null, tracking = false;

  function status(t){$("status").textContent=t}
  function exec(cmd, value=null){editor.focus();document.execCommand(cmd,false,value);sync()}
  function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
  function text(){return editor.innerText || ""}
  function htmlDoc(){return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title.value)}</title><style>body{background:#ddd;font-family:Aptos,Calibri,Arial}.page{width:816px;min-height:1056px;background:#fff;margin:30px auto;padding:96px;box-shadow:0 4px 18px #777}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:7px}img{max-width:100%}</style></head><body><main class="page">${editor.innerHTML}</main></body></html>`}
  function filename(ext){return (title.value || "Documento1").replace(/[\\/:*?"<>|]/g,"-")+"."+ext}

  function asciiBytes(str){const a=new Uint8Array(str.length);for(let i=0;i<str.length;i++)a[i]=str.charCodeAt(i)&255;return a;}
  function binaryStringToBytes(str){const a=new Uint8Array(str.length);for(let i=0;i<str.length;i++)a[i]=str.charCodeAt(i)&255;return a;}
  function bytesFromDataUrl(dataUrl){return binaryStringToBytes(atob(dataUrl.split(',')[1]||''));}
  async function pageToCanvas(){
    const original=page;
    const rectWidth=Math.max(original.scrollWidth, 816);
    const rectHeight=Math.max(original.scrollHeight, 1056);
    let cssText='';
    Array.from(document.styleSheets).forEach(sheet=>{try{Array.from(sheet.cssRules||[]).forEach(rule=>cssText+=rule.cssText+'\n')}catch(e){}});
    const clone=original.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.transform='none';
    clone.style.margin='0';
    clone.style.boxShadow='none';
    clone.style.width=rectWidth+'px';
    clone.style.minHeight=rectHeight+'px';
    clone.style.height=rectHeight+'px';
    clone.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));
    clone.querySelectorAll('.spelling-error').forEach(n=>{n.classList.remove('spelling-error')});
    const serialized=new XMLSerializer().serializeToString(clone);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${rectWidth}" height="${rectHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${cssText}\n.page{transform:none!important;margin:0!important;box-shadow:none!important;border:0!important}.header-area,.footer-area{border-color:transparent!important}</style>${serialized}</div></foreignObject></svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    try{
      const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});
      const canvas=document.createElement('canvas');
      const scale=Math.min(2, window.devicePixelRatio||1.5);
      canvas.width=Math.round(rectWidth*scale); canvas.height=Math.round(rectHeight*scale);
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  }
  function buildImagePdf(jpegDataUrls, sliceSizes, docName){
    const pdfW=612, pdfH=792;
    const objects=[];
    function addBytes(bytes){objects.push(bytes);return objects.length;}
    function addText(txt){return addBytes(asciiBytes(txt));}
    const imageRefs=[];
    jpegDataUrls.forEach((url,i)=>{
      const bytes=bytesFromDataUrl(url);
      const w=sliceSizes[i].w,h=sliceSizes[i].h;
      const header=`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`;
      const footer='\nendstream';
      const merged=new Uint8Array(asciiBytes(header).length+bytes.length+asciiBytes(footer).length);
      let pos=0; merged.set(asciiBytes(header),pos); pos+=asciiBytes(header).length; merged.set(bytes,pos); pos+=bytes.length; merged.set(asciiBytes(footer),pos);
      imageRefs.push(addBytes(merged));
    });
    const pageRefs=[];
    imageRefs.forEach((imgRef,i)=>{
      const imgW=sliceSizes[i].w,imgH=sliceSizes[i].h;
      const drawH=Math.min(pdfH, pdfW*(imgH/imgW));
      const y=(pdfH-drawH);
      const stream=`q\n${pdfW} 0 0 ${drawH.toFixed(2)} 0 ${y.toFixed(2)} cm\n/Im${i+1} Do\nQ`;
      const content=addText(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageObj=addText(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im${i+1} ${imgRef} 0 R >> >> /Contents ${content} 0 R >>`);
      pageRefs.push(pageObj);
    });
    const pagesObj=addText(`<< /Type /Pages /Kids [${pageRefs.map(n=>n+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`);
    pageRefs.forEach(n=>{let s=new TextDecoder('latin1').decode(objects[n-1]);s=s.replace('/Parent 0 0 R','/Parent '+pagesObj+' 0 R');objects[n-1]=asciiBytes(s);});
    const catalogObj=addText(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
    const chunks=[];let length=0;const offsets=[0];
    function push(bytes){chunks.push(bytes);length+=bytes.length;}
    push(asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    objects.forEach((obj,i)=>{offsets.push(length);push(asciiBytes(`${i+1} 0 obj\n`));push(obj);push(asciiBytes('\nendobj\n'));});
    const xref=length;
    let xrefText=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<offsets.length;i++)xrefText+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    xrefText+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    push(asciiBytes(xrefText));
    const result=new Uint8Array(length);let pos=0;chunks.forEach(c=>{result.set(c,pos);pos+=c.length;});
    return new Blob([result],{type:'application/pdf'});
  }
  async function downloadPDF(){
    status('Generando PDF como captura exacta de la hoja...');
    await document.fonts?.ready?.catch(()=>{});
    const canvas=await pageToCanvas();
    const pageSliceHeight=Math.round(canvas.width*(792/612));
    const urls=[],sizes=[];
    for(let y=0;y<canvas.height;y+=pageSliceHeight){
      const h=Math.min(pageSliceHeight, canvas.height-y);
      const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=h;
      const ctx=slice.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,slice.width,slice.height);ctx.drawImage(canvas,0,y,canvas.width,h,0,0,slice.width,h);
      urls.push(slice.toDataURL('image/jpeg',0.95));sizes.push({w:slice.width,h:slice.height});
    }
    const docName=(title.value||'Documento1 - Word').replace(/[\\/:*?"<>|]/g,'-');
    const blob=buildImagePdf(urls,sizes,docName);
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=docName+'.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    status('PDF descargado: '+docName+'.pdf');
  }
  function download(type){if(type==="pdf"){downloadPDF();return;}let blob,name;if(type==="txt"){blob=new Blob([text()],{type:"text/plain;charset=utf-8"});name=filename("txt")}else if(type==="json"){blob=new Blob([JSON.stringify({title:title.value,header:$("headerArea").innerHTML,html:editor.innerHTML,footer:$("footerArea").innerHTML,savedAt:new Date().toISOString()},null,2)],{type:"application/json"});name=filename("json")}else{blob=new Blob([htmlDoc()],{type:"text/html;charset=utf-8"});name=filename("html")}let url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);status("Archivo descargado: "+name)}
  function save(){let payload={title:title.value,header:$("headerArea").innerHTML,html:editor.innerHTML,footer:$("footerArea").innerHTML,savedAt:new Date().toISOString()};localStorage.setItem(STORAGE,JSON.stringify(payload));$("infoSaved").textContent=new Date(payload.savedAt).toLocaleString();status("Guardado localmente")}
  function openFile(file){if(!file)return;let r=new FileReader();r.onload=()=>{let c=String(r.result||"");try{if(file.name.endsWith(".json")){let p=JSON.parse(c);title.value=p.title||"Documento1 - Word";$("headerArea").innerHTML=p.header||"";editor.innerHTML=p.html||defaultHtml;$("footerArea").innerHTML=p.footer||""}else if(file.name.endsWith(".txt")){title.value=file.name.replace(/\.[^/.]+$/,'')+" - Word";editor.innerHTML="<p>"+escapeHtml(c).replace(/\n/g,"<br>")+"</p>"}else{title.value=file.name.replace(/\.[^/.]+$/,'')+" - Word";editor.innerHTML=c}sync();status("Archivo abierto: "+file.name)}catch(e){status("No se pudo abrir el archivo")}};r.readAsText(file)}
  function sync(){let t=text(),w=t.trim()?t.trim().split(/\s+/).length:0,c=t.length,pages=Math.max(1,Math.ceil(editor.scrollHeight/940));$("words").textContent=w;$("chars").textContent=c;$("pages").textContent=pages;$("wordStatus").textContent=w+" palabras";$("pageStatus").textContent="Página 1 de "+pages;$("infoName").textContent=title.value;buildHeadings()}
  function buildHeadings(){let list=$("headingList");list.innerHTML="";editor.querySelectorAll("h1,h2,h3").forEach((h,i)=>{let li=document.createElement("li");li.textContent=h.innerText||("Encabezado "+(i+1));li.onclick=()=>h.scrollIntoView({behavior:"smooth",block:"center"});list.appendChild(li)})}
  function insertTable(){let r=Math.max(1,+prompt("Filas","3")||3),c=Math.max(1,+prompt("Columnas","3")||3),s='<table>';for(let i=0;i<r;i++){s+='<tr>';for(let j=0;j<c;j++)s+='<td><br></td>';s+='</tr>'}s+='</table><p><br></p>';exec('insertHTML',s)}
  function insertImage(file){if(!file)return;let r=new FileReader();r.onload=()=>exec('insertHTML',`<img src="${r.result}" alt="Imagen insertada">`);r.readAsDataURL(file)}
  function showModal(h,b){$("modalTitle").textContent=h;$("modalBody").innerHTML=b;modal.showModal()}
  function selectedText(){return String(window.getSelection()||"")}
  function replaceAll(){let f=($("findTextSide").value||$("findText").value),r=$("replaceText").value;if(!f)return;let esc=f.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");editor.innerHTML=editor.innerHTML.replace(new RegExp(esc,"gi"),escapeHtml(r));sync();status("Reemplazo aplicado")}
  function find(){let f=($("findText").value||$("findTextSide").value);if(!f)return;editor.focus();let ok=window.find(f,false,false,true,false,true,false);status(ok?"Coincidencia encontrada":"Sin coincidencias")}
  function applyZoom(v){zoom=Math.max(50,Math.min(160,+v));page.style.transform=`scale(${zoom/100})`;page.style.marginBottom=`${1056*(zoom/100-1)+32}px`;$("zoomRange").value=zoom;$("zoomLabel").textContent=zoom+"%"}
  function styleBlock(kind){if(kind==="normal")exec("formatBlock","p");if(kind==="h1")exec("formatBlock","h1");if(kind==="h2")exec("formatBlock","h2");if(kind==="title")exec("insertHTML",`<h1 style="font-size:32px;text-align:center">${selectedText()||"Título del documento"}</h1>`);if(kind==="subtitle")exec("insertHTML",`<p style="font-size:18px;color:#666;text-align:center">${selectedText()||"Subtítulo"}</p>`);if(kind==="noSpacing")exec("insertHTML",`<p style="margin:0;line-height:1.1">${selectedText()||"Texto sin espaciado"}</p>`)}

  function applyLineSpacing(value){
    editor.focus();
    const selection=window.getSelection();
    if(selection && selection.rangeCount && !selection.isCollapsed){
      let node=selection.anchorNode;
      if(node && node.nodeType===3) node=node.parentElement;
      const block=node?.closest?.('p,div,li,td,th,h1,h2,h3,blockquote') || editor;
      block.style.lineHeight=value;
    } else {
      editor.style.lineHeight=value;
    }
    status('Interlineado aplicado: '+value);
    sync();
  }
  const spellingCorrections = {"actualziacion":"actualización","actualziación":"actualización","actualizacion":"actualización","actualziaciones":"actualizaciones","funcuona":"funciona","ajusatr":"ajustar","sustitya":"sustituya","inzquierda":"izquierda","izqueirda":"izquierda","derehca":"derecha","centrdo":"centrado","asegur":"asegurar","erroes":"errores","otrograficos":"ortográficos","otrograficas":"ortográficas","ortograficos":"ortográficos","ortografico":"ortográfico","espanol":"español","modeo":"modelo","dede":"debe","toanlidad":"tonalidad","corrigira":"corregirá","corregira":"corregirá","automatico":"automático","automaticamente":"automáticamente","descargara":"descargará","opcion":"opción","revision":"revisión","redaccion":"redacción","diccionaro":"diccionario","palbras":"palabras","gramatica":"gramática","nisiquiera":"ni siquiera","autual":"actual","aint":"interfaz","poseea":"posea"};
  const ignoredWords = new Set();
  const dictionaryWords = new Set((window.DICCIONARIO_BASICO_ES || []).map(w => normalizeWord(w)));
  const shortAllowed = new Set(['yo','tu','tú','el','él','la','lo','le','se','me','te','si','sí','no','ya','de','da','di','do','al','un','una','y','o','u','e','a','en','es','ha','he','ir','va','ve','vi','mi','su']);
  let dictionaryPrefixIndex = null;
  function normalizeWord(w){return String(w||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function buildDictionaryPrefixIndex(){
    if(dictionaryPrefixIndex) return dictionaryPrefixIndex;
    dictionaryPrefixIndex = {};
    dictionaryWords.forEach(w => {
      const key = w.slice(0,2) || w[0] || '';
      if(!dictionaryPrefixIndex[key]) dictionaryPrefixIndex[key] = [];
      dictionaryPrefixIndex[key].push(w);
    });
    return dictionaryPrefixIndex;
  }
  function damerauLevenshtein(a,b,max=3){
    if(Math.abs(a.length-b.length)>max) return max+1;
    const da={};
    const INF=a.length+b.length;
    const d=Array.from({length:a.length+2},()=>Array(b.length+2).fill(0));
    d[0][0]=INF;
    for(let i=0;i<=a.length;i++){d[i+1][0]=INF;d[i+1][1]=i;}
    for(let j=0;j<=b.length;j++){d[0][j+1]=INF;d[1][j+1]=j;}
    for(let i=1;i<=a.length;i++){
      let db=0;
      for(let j=1;j<=b.length;j++){
        const i1=da[b[j-1]]||0, j1=db;
        let cost=1;
        if(a[i-1]===b[j-1]){cost=0;db=j;}
        d[i+1][j+1]=Math.min(d[i][j]+cost,d[i+1][j]+1,d[i][j+1]+1,d[i1][j1]+(i-i1-1)+1+(j-j1-1));
      }
      da[a[i-1]]=i;
    }
    return d[a.length+1][b.length+1];
  }
  function suggestWord(original){
    const w=normalizeWord(original);
    const direct = spellingCorrections[original.toLowerCase()] || spellingCorrections[w];
    if(direct) return direct;
    if(!w || w.length<4) return '';
    const idx=buildDictionaryPrefixIndex();
    const keys=[w.slice(0,2), w[0]].filter(Boolean);
    let candidates=[];
    keys.forEach(k => { if(idx[k]) candidates=candidates.concat(idx[k]); });
    if(!candidates.length) return '';
    let best='',bestScore=4;
    const limit = candidates.slice(0, 2500);
    for(const c of limit){
      if(Math.abs(c.length-w.length)>2) continue;
      const score=damerauLevenshtein(w,c,3);
      if(score<bestScore){bestScore=score;best=c;if(score===1)break;}
    }
    const threshold = w.length >= 7 ? 2 : 1;
    return bestScore<=threshold ? best : '';
  }
  function isLikelyCorrectWord(word){
    const w=normalizeWord(word);
    if(!w) return true;
    if(shortAllowed.has(w)) return true;
    if(w.length<=2) return true;
    if(dictionaryWords.has(w)) return true;
    if(/^[ivxlcdm]+$/i.test(word)) return true;
    if(/^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+$/.test(word)) return true;
    if(w.endsWith('mente') && dictionaryWords.has(w.slice(0,-5))) return true;
    return false;
  }
  function collectSpellingIssues(){
    const raw=text();
    const seen=new Set(), issues=[];
    const words=raw.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g)||[];
    words.forEach(w=>{
      const key=w.toLowerCase(); const norm=normalizeWord(w);
      if(ignoredWords.has(key) || seen.has(key)) return;
      const mapped=spellingCorrections[key]||spellingCorrections[norm];
      if(mapped && mapped.toLowerCase()!==key){seen.add(key);issues.push({word:w,key,suggestion:mapped,reason:'Corrección frecuente'});return;}
      if(!isLikelyCorrectWord(w)){
        const suggestion=suggestWord(w);
        if(suggestion){
          seen.add(key);
          issues.push({word:w,key,suggestion,reason:'No aparece en los diccionarios locales'});
        }
      }
    });
    return issues;
  }
  function clearSpellingMarks(){
    editor.querySelectorAll('.spelling-error').forEach(span=>{const t=document.createTextNode(span.textContent);span.replaceWith(t);});
    editor.normalize();sync();status('Marcas de ortografía omitidas');
  }
  function markSpellingIssues(){
    clearSpellingMarks();
    const issues=collectSpellingIssues();
    if(!issues.length){status('Ortografía revisada: sin errores detectados');return issues;}
    const map=new Map(issues.map(i=>[i.key,i]));
    const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('.spelling-error')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parts=node.nodeValue.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/g);
      const frag=document.createDocumentFragment(); let changed=false;
      parts.forEach(part=>{const issue=map.get(part.toLowerCase()); if(issue){const s=document.createElement('span');s.className='spelling-error';s.dataset.suggestion=issue.suggestion;s.textContent=part;frag.appendChild(s);changed=true;}else frag.appendChild(document.createTextNode(part));});
      if(changed) node.replaceWith(frag);
    });
    sync();status('Ortografía: '+issues.length+' posible(s) error(es) detectado(s)');return issues;
  }
  function replaceSpellingWord(word,suggestion){
    const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    editor.innerHTML=editor.innerHTML.replace(new RegExp('>'+escaped+'<','gi'), '>'+suggestion+'<').replace(new RegExp(escaped,'gi'), suggestion);
    clearSpellingMarks();markSpellingIssues();
  }
  function openSpellingPanel(){
    const issues=markSpellingIssues();
    if(!issues.length){showModal('Ortografía','<p>No se detectaron errores con el corrector basado en el diccionario local en Español Internacional.</p>');return;}
    const items=issues.map((it,idx)=>`<div class="spell-item"><div>Posible error: <b>${escapeHtml(it.word)}</b></div><div>Sugerencia: <strong>${escapeHtml(it.suggestion)}</strong></div><small>${escapeHtml(it.reason||'')}</small><div class="spell-actions"><button type="button" data-spell-replace="${idx}">Cambiar</button><button type="button" data-spell-ignore="${idx}">Omitir</button></div></div>`).join('');
    showModal('Ortografía y gramática',`<p>Idioma: Español Internacional. Puedes cambiar la palabra sugerida u omitirla.</p><div class="spell-list">${items}</div>`);
    setTimeout(()=>{
      document.querySelectorAll('[data-spell-replace]').forEach(btn=>btn.onclick=()=>{const it=issues[+btn.dataset.spellReplace];if(it.suggestion && it.suggestion!=='Sin sugerencia') replaceSpellingWord(it.word,it.suggestion); modal.close();openSpellingPanel();});
      document.querySelectorAll('[data-spell-ignore]').forEach(btn=>btn.onclick=()=>{const it=issues[+btn.dataset.spellIgnore];ignoredWords.add(it.key);modal.close();openSpellingPanel();});
    },0);
  }
  function doAction(a){switch(a){case"open":$("fileOpen").click();break;case"save":save();break;case"print":window.print();break;case"new":title.value="Documento1 - Word";$("headerArea").innerHTML="";$("footerArea").innerHTML="";editor.innerHTML=defaultHtml;applyLineSpacing("1.5");sync();status("Nuevo documento en blanco");break;case"closeBackstage":backstage.hidden=true;break;case"toggleTextPalette":$("textPalette").hidden=!$("textPalette").hidden;$("highlightPalette").hidden=true;break;case"toggleHighlightPalette":$("highlightPalette").hidden=!$("highlightPalette").hidden;$("textPalette").hidden=true;break;case"copyFormat":copiedFormat=document.queryCommandValue("fontName")+"|"+document.queryCommandValue("fontSize");status("Formato copiado de forma simulada");break;case"growFont":exec("fontSize",5);break;case"shrinkFont":exec("fontSize",2);break;case"changeCase":exec("insertText",selectedText().toUpperCase());break;case"subscript":exec("subscript");break;case"superscript":exec("superscript");break;case"multilevel":exec("insertHTML","<ol><li>Elemento<ol><li>Subelemento</li></ol></li></ol>");break;case"sort":let arr=text().split(/\n+/).sort();editor.innerHTML=arr.map(x=>`<p>${escapeHtml(x)}</p>`).join("");sync();break;case"showMarks":document.body.classList.toggle("show-marks");status("Marcas de párrafo simuladas");break;case"lineHeight":applyLineSpacing("1.5");break;case"shading":exec("backColor","#eaf2ff");break;case"borders":exec("insertHTML",`<div style="border:1px solid #333;padding:8px">${selectedText()||"Texto con borde"}</div>`);break;case"find":find();break;case"replace":showModal("Buscar y reemplazar",`<label>Buscar</label><input id="mFind" style="width:100%;margin:8px 0" value="${escapeHtml($("findText").value||"")}"><label>Reemplazar con</label><input id="mRep" style="width:100%;margin:8px 0"><button type="button" onclick="document.getElementById('findTextSide').value=document.getElementById('mFind').value;document.getElementById('replaceText').value=document.getElementById('mRep').value;document.getElementById('btnReplaceAll').click();document.querySelector('dialog').close();">Reemplazar todo</button>`);break;case"selectAll":exec("selectAll");break;case"addins":showModal("Complementos", "<p>Panel simulado de complementos, similar al grupo Complementos de Word.</p>");break;case"cover":exec("insertHTML","<section style='text-align:center;padding:180px 20px'><h1>Portada</h1><p>Autor y fecha</p></section><hr style='page-break-after:always'>");break;case"blankPage":exec("insertHTML","<hr style='page-break-after:always'><p><br></p>");break;case"pageBreak":exec("insertHTML","<hr style='page-break-after:always;border:0;border-top:2px dashed #aaa;margin:32px 0'>");break;case"table":insertTable();break;case"image":$("imageOpen").click();break;case"shapes":exec("insertHTML","<div style='width:130px;height:80px;border-radius:50%;border:2px solid #333'></div>");break;case"icons":exec("insertHTML","<span style='font-size:42px'>★</span>");break;case"smartArt":exec("insertHTML","<div style='display:flex;gap:12px;align-items:center'><div style='background:#dbeafe;padding:16px;border-radius:10px'>Idea</div>→<div style='background:#dcfce7;padding:16px;border-radius:10px'>Proceso</div>→<div style='background:#fee2e2;padding:16px;border-radius:10px'>Resultado</div></div>");break;case"chart":exec("insertHTML","<div style='display:flex;align-items:end;gap:8px;height:140px'><div style='height:60px;background:#60a5fa;width:50px'></div><div style='height:110px;background:#2563eb;width:50px'></div><div style='height:80px;background:#93c5fd;width:50px'></div></div>");break;case"link":let url=prompt("URL","https://");if(url)exec("createLink",url);break;case"bookmark":exec("insertHTML","<a id='marcador'></a>");break;case"header":$("headerArea").focus();break;case"footer":$("footerArea").focus();break;case"pageNumber":$("footerArea").innerHTML="Página 1";break;case"textBox":exec("insertHTML","<div class='textbox' contenteditable='true'>Cuadro de texto</div>");break;case"wordArt":exec("insertHTML","<div style='font-size:42px;font-weight:bold;color:#1d4ed8;text-shadow:2px 2px #bfdbfe'>WordArt</div>");break;case"date":exec("insertHTML",new Date().toLocaleString());break;case"watermark":if(!page.querySelector('.watermark')){let w=document.createElement('div');w.className='watermark';w.textContent='BORRADOR';page.appendChild(w)}break;case"pageColor":page.style.background=page.style.background==="rgb(255, 250, 230)"?"#fff":"#fffae6";break;case"pageBorder":page.style.outline=page.style.outline?"":"3px double #333";break;case"margins":editor.style.padding="56px 72px";status("Márgenes moderados aplicados");break;case"orientation":page.classList.toggle("landscape");if(page.classList.contains("landscape")){page.style.width="1056px";page.style.minHeight="816px"}else{page.style.width="816px";page.style.minHeight="1056px"}break;case"size":showModal("Tamaño de página","<p>Simulación: carta/A4 visual en pantalla.</p>");break;case"columns":exec("insertHTML","<div style='columns:2;column-gap:36px'><p>Texto en columnas. Escribe aquí para simular la opción Columnas de Word.</p><p>Segunda columna del bloque.</p></div>");break;case"breaks":doAction("pageBreak");break;case"indentLeft":exec("indent");break;case"indentRight":exec("outdent");break;case"spacingBefore":exec("insertHTML","<p style='margin-top:28px'>Párrafo con espacio antes</p>");break;case"spacingAfter":exec("insertHTML","<p style='margin-bottom:28px'>Párrafo con espacio después</p>");break;case"position":status("Posición simulada: selecciona imágenes y usa ajustar texto visualmente");break;case"wrapText":exec("insertHTML","<div style='float:right;width:160px;border:1px solid #aaa;padding:8px;margin:8px'>Objeto con ajuste de texto</div>");break;case"bringFront":status("Traer adelante simulado");break;case"sendBack":status("Enviar atrás simulado");break;case"toc":let hs=[...editor.querySelectorAll('h1,h2,h3')].map(h=>`<li>${escapeHtml(h.innerText)}</li>`).join('');exec("insertHTML",`<h2>Tabla de contenido</h2><ol>${hs||'<li>Agrega títulos para generar contenido</li>'}</ol>`);break;case"addText":exec("formatBlock","h2");break;case"footnote":exec("insertHTML","<sup>[1]</sup><p style='font-size:12px'>[1] Nota al pie simulada.</p>");break;case"endnote":exec("insertHTML","<p style='font-size:12px'>Nota al final simulada.</p>");break;case"citation":exec("insertHTML","<span>(Autor, 2026)</span>");break;case"bibliography":exec("insertHTML","<h2>Bibliografía</h2><p>Autor. Título. Editorial, 2026.</p>");break;case"caption":exec("insertHTML","<p style='font-size:12px;text-align:center'>Figura 1. Título de imagen</p>");break;case"index":exec("insertHTML","<p><b>Entrada de índice:</b> "+escapeHtml(selectedText()||"término")+"</p>");break;case"envelopes":showModal("Sobres","<p>Herramienta de sobres simulada.</p>");break;case"labels":showModal("Etiquetas","<p>Herramienta de etiquetas simulada.</p>");break;case"startMerge":status("Combinación de correspondencia iniciada");break;case"recipients":showModal("Destinatarios","<textarea>Nombre,Correo\nSamuel,samuel@example.com</textarea>");break;case"insertMergeField":exec("insertHTML","«Nombre»");break;case"previewResults":status("Vista previa de resultados simulada");break;case"finishMerge":status("Combinación finalizada de forma simulada");break;case"spelling":openSpellingPanel();break;case"spellCheckNow":openSpellingPanel();break;case"clearSpellingMarks":clearSpellingMarks();break;case"thesaurus":showModal("Sinónimos","<p>Selecciona una palabra para consultar sinónimos de forma simulada.</p>");break;case"wordCount":showModal("Contar palabras",`<p>Palabras: ${$("words").textContent}</p><p>Caracteres: ${$("chars").textContent}</p>`);break;case"comment":exec("insertHTML","<aside class='comment'>Comentario: escribe aquí.</aside>");break;case"deleteComments":editor.querySelectorAll('.comment').forEach(x=>x.remove());sync();break;case"trackChanges":tracking=!tracking;status("Control de cambios "+(tracking?"activado":"desactivado"));break;case"acceptChange":status("Cambio aceptado de forma simulada");break;case"rejectChange":status("Cambio rechazado de forma simulada");break;case"protect":editor.contentEditable=editor.contentEditable==="false"?"true":"false";status(editor.contentEditable==="false"?"Edición restringida":"Edición habilitada");break;case"zoomOut":applyZoom(zoom-10);break;case"zoomIn":applyZoom(zoom+10);break;case"zoom100":applyZoom(100);break;case"onePage":applyZoom(75);break;case"preview":showModal("Vista previa",`<div style='width:100%;max-height:65vh;overflow:auto;background:#ddd;padding:20px'><div style='background:#fff;margin:auto;max-width:816px;padding:50px'>${editor.innerHTML}</div></div>`);break;case"newWindow":window.open(location.href,"_blank");break;case"split":status("Dividir ventana simulado");break;case"help":showModal("Ayuda","<p>Usa las pestañas de la cinta para encontrar las herramientas, igual que en Word.</p>");break;case"training":showModal("Aprendizaje","<p>Prueba Inicio para formato, Insertar para objetos y Vista para zoom.</p>");break;case"feedback":showModal("Comentarios","<p>Simulación de comentarios de la aplicación.</p>");break;case"paraphrase":exec("insertHTML","<p><b>Paráfrasis simulada:</b> "+escapeHtml(selectedText()||"Selecciona texto para parafrasear.")+"</p>");break;case"summarize":showModal("Resumen",`<p>${escapeHtml(text().split(/\s+/).slice(0,40).join(" "))}...</p>`);break;case"grammar":showModal("Gramática","<p>Revisión gramatical simulada completada.</p>");break;}}

  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{if(b.dataset.tab==="archivo"){backstage.hidden=false;return}document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.ribbon').forEach(x=>x.classList.remove('active'));$("tab-"+b.dataset.tab)?.classList.add('active')});
  document.querySelectorAll("[data-backstage]").forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.backstage-panel').forEach(p=>p.classList.remove('active'));
    const panel=$("backstage-"+b.dataset.backstage);
    if(panel) panel.classList.add('active');
    document.querySelectorAll('.backstage-menu button').forEach(x=>x.classList.remove('back-active'));
    b.classList.add('back-active');
  }));
  $("saveAsFormat")?.addEventListener('change',e=>{ if(e.target.value==='pdf') downloadPDF(); });
  document.querySelectorAll("[data-cmd]").forEach(b=>b.addEventListener('click',()=>exec(b.dataset.cmd)));
  document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener('click',()=>doAction(b.dataset.action)));
  document.querySelectorAll("[data-download]").forEach(b=>b.addEventListener('click',()=>download(b.dataset.download)));
  document.querySelectorAll("[data-style]").forEach(b=>b.addEventListener('click',()=>styleBlock(b.dataset.style)));
  document.querySelectorAll("[data-theme]").forEach(b=>b.addEventListener('click',()=>{document.body.classList.remove('theme-blue','theme-green','theme-gray');if(b.dataset.theme!=="office")document.body.classList.add('theme-'+b.dataset.theme);status('Tema aplicado')}));
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener('click',()=>{document.body.classList.remove('web-view','read-view');if(b.dataset.view==='web')document.body.classList.add('web-view');if(b.dataset.view==='read')document.body.classList.add('read-view');$("viewStatus").textContent=b.textContent;status('Vista cambiada')}));
  $("fontFamily").onchange=e=>exec('fontName',e.target.value.replace(' (Cuerpo)',''));
  $("fontSize").onchange=e=>exec('fontSize',Math.max(1,Math.min(7,Math.round(Number(e.target.value)/7))));
  $("textColor").oninput=e=>{exec('foreColor',e.target.value);$("textColorSwatch").style.background=e.target.value};
  $("highlightColor").oninput=e=>{exec('hiliteColor',e.target.value);$("highlightSwatch").style.background=e.target.value};
  $("lineSpacing")?.addEventListener('change',e=>applyLineSpacing(e.target.value));
  document.querySelectorAll('[data-color-target]').forEach(btn=>btn.addEventListener('click',()=>{
    const cmd=btn.dataset.colorTarget, color=btn.dataset.color;
    exec(cmd,color);
    if(cmd==='foreColor')$("textColorSwatch").style.background=color;
    if(cmd==='hiliteColor')$("highlightSwatch").style.background=color;
    document.querySelectorAll('.palette-popover').forEach(p=>p.hidden=true);
  }));
  document.addEventListener('click',e=>{if(!e.target.closest('.palette-wrapper'))document.querySelectorAll('.palette-popover').forEach(p=>p.hidden=true);});

  $("fileOpen").onchange=e=>{openFile(e.target.files[0]);e.target.value=''};
  $("imageOpen").onchange=e=>{insertImage(e.target.files[0]);e.target.value=''};
  $("btnReplaceAll").onclick=replaceAll;
  $("zoomRange").oninput=e=>applyZoom(e.target.value);
  $("toggleRuler").onchange=e=>document.querySelector('.ruler').style.display=e.target.checked?'flex':'none';
  $("toggleNav").onchange=e=>$("navigationPane").style.display=e.target.checked?'block':'none';
  $("toggleGrid").onchange=e=>document.querySelector('.canvas-wrap').style.background=e.target.checked?'repeating-linear-gradient(0deg,#d7dbe0 0 29px,#c8ccd2 30px),repeating-linear-gradient(90deg,transparent 0 29px,#c8ccd2 30px)':'#d7dbe0';
  let spellTimer=null;editor.addEventListener('input',()=>{sync();clearTimeout(spellTimer);spellTimer=setTimeout(()=>{const n=collectSpellingIssues().length;if(n)status('Revisar: '+n+' posible(s) error(es) ortográfico(s)');},650);}); title.addEventListener('input',sync);
  window.addEventListener('keydown',e=>{let mod=e.ctrlKey||e.metaKey;if(!mod)return;let k=e.key.toLowerCase();if(k==='s'){e.preventDefault();save()}if(k==='b'){e.preventDefault();exec('bold')}if(k==='i'){e.preventDefault();exec('italic')}if(k==='u'){e.preventDefault();exec('underline')}if(k==='f'){e.preventDefault();$("findText").focus()}});
  function boot(){let s=localStorage.getItem(STORAGE);if(s){try{let p=JSON.parse(s);title.value=p.title||"Documento1 - Word";$("headerArea").innerHTML=p.header||"";editor.innerHTML=p.html||defaultHtml;$("footerArea").innerHTML=p.footer||"";if(p.savedAt)$("infoSaved").textContent=new Date(p.savedAt).toLocaleString()}catch{editor.innerHTML=defaultHtml}}else {editor.innerHTML=defaultHtml;$("headerArea").innerHTML="";$("footerArea").innerHTML="";}applyZoom(100);applyLineSpacing("1.5");document.getElementById("fontFamily").value="Arial";document.getElementById("fontSize").value="12";document.getElementById("lineSpacing").value="1.5";sync();}
  boot();
})();



;/* ===== samuel-final-fixes-js ===== */

(function () {
  function onReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }

  onReady(function () {
    ensureBackArrow();
    fixPalettes();
    replaceSaveAsSelectListeners();
  });

  function ensureBackArrow() {
    var backstage = document.getElementById('backstage');
    var menu = document.querySelector('.backstage-menu');
    if (!backstage || !menu) return;

    var oldArrow = menu.querySelector('.back-arrow, .samuel-back-arrow');
    if (!oldArrow) {
      oldArrow = document.createElement('button');
      menu.insertBefore(oldArrow, menu.firstChild);
    }
    oldArrow.type = 'button';
    oldArrow.className = 'samuel-back-arrow';
    oldArrow.textContent = '←';
    oldArrow.title = 'Volver al documento';
    oldArrow.setAttribute('aria-label', 'Volver al documento');
    oldArrow.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      backstage.hidden = true;
      document.querySelectorAll('.backstage-panel').forEach(function (panel) { panel.classList.remove('active'); });
      var infoPanel = document.getElementById('backstage-info');
      if (infoPanel) infoPanel.classList.add('active');
    };
  }

  function fixPalettes() {
    function place(button, palette) {
      if (!button || !palette || palette.hidden) return;
      var rect = button.getBoundingClientRect();
      palette.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 270)) + 'px';
      palette.style.top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 430)) + 'px';
      palette.style.right = 'auto';
      palette.style.bottom = 'auto';
    }

    document.addEventListener('click', function (event) {
      var textButton = event.target.closest('[data-action="toggleTextPalette"]');
      var highButton = event.target.closest('[data-action="toggleHighlightPalette"]');
      if (textButton) setTimeout(function () { place(textButton, document.getElementById('textPalette')); }, 0);
      if (highButton) setTimeout(function () { place(highButton, document.getElementById('highlightPalette')); }, 0);
    }, true);

    window.addEventListener('resize', function () {
      place(document.querySelector('[data-action="toggleTextPalette"]'), document.getElementById('textPalette'));
      place(document.querySelector('[data-action="toggleHighlightPalette"]'), document.getElementById('highlightPalette'));
    });
  }

  function replaceSaveAsSelectListeners() {
    var original = document.getElementById('saveAsFormat');
    if (!original) return;

    var clone = original.cloneNode(true);
    original.parentNode.replaceChild(clone, original);

    function handle(event) {
      if (clone.value !== 'pdf') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (clone.dataset.generating === '1') return;
      clone.dataset.generating = '1';
      generatePdfFromWorkingSheet()
        .catch(function (error) {
          console.error(error);
          fallbackPdfFromHtmlText(error);
        })
        .finally(function () {
          clone.dataset.generating = '0';
          clone.selectedIndex = -1;
        });
    }

    clone.addEventListener('change', handle, true);
    clone.addEventListener('click', handle, true);
    clone.addEventListener('keyup', handle, true);
  }

  async function generatePdfFromWorkingSheet() {
    var pages = Array.prototype.slice.call(document.querySelectorAll('.samuel-pdf-page'));
    if (!pages.length) {
      var fallbackPage = document.getElementById('page');
      if (fallbackPage) pages = [fallbackPage];
    }
    if (!pages.length) throw new Error('No se encontraron las hojas del documento.');
    setStatus('Generando PDF visual de las ' + pages.length + ' secciones...');

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }

    var slices = [];
    for (var i = 0; i < pages.length; i++) {
      var canvas = await renderPageCanvas(pages[i]);
      slices = slices.concat(canvasToJpegSlices(canvas));
    }
    var blob = buildPdf(slices);
    downloadBlob(blob, getDocumentName() + '.pdf');
    setStatus('PDF descargado con ' + pages.length + ' secciones: ' + getDocumentName() + '.pdf');
  }

  async function renderPageCanvas(page) {
    /* PDF-only fix: export each simulated Word sheet as one fixed Letter canvas. */
    var PAGE_WIDTH = 816;
    var PAGE_HEIGHT = 1056;
    var width = PAGE_WIDTH;
    var height = PAGE_HEIGHT;
    var clone = page.cloneNode(true);

    clone.removeAttribute('id');
    clone.querySelectorAll('[contenteditable]').forEach(function (node) { node.removeAttribute('contenteditable'); });
    clone.querySelectorAll('.spelling-error').forEach(function (node) { node.classList.remove('spelling-error'); });
    inlineStyles(page, clone);

    clone.style.setProperty('display', 'block', 'important');
    clone.style.setProperty('position', 'relative', 'important');
    clone.style.setProperty('left', '0', 'important');
    clone.style.setProperty('top', '0', 'important');
    clone.style.setProperty('transform', 'none', 'important');
    clone.style.setProperty('margin', '0', 'important');
    clone.style.setProperty('box-shadow', 'none', 'important');
    clone.style.setProperty('border', '0', 'important');
    clone.style.setProperty('overflow', 'hidden', 'important');
    clone.style.setProperty('width', width + 'px', 'important');
    clone.style.setProperty('min-width', width + 'px', 'important');
    clone.style.setProperty('max-width', width + 'px', 'important');
    clone.style.setProperty('height', height + 'px', 'important');
    clone.style.setProperty('min-height', height + 'px', 'important');
    clone.style.setProperty('max-height', height + 'px', 'important');
    clone.style.setProperty('background', '#ffffff', 'important');

    clone.querySelectorAll('.editor, .section-editor').forEach(function (node) {
      node.style.setProperty('max-width', '100%', 'important');
      node.style.setProperty('box-sizing', 'border-box', 'important');
      node.style.setProperty('overflow', 'hidden', 'important');
    });
    clone.querySelectorAll('table').forEach(function (table) {
      table.style.setProperty('max-width', '100%', 'important');
      table.style.setProperty('box-sizing', 'border-box', 'important');
      table.style.setProperty('table-layout', 'fixed', 'important');
    });
    clone.querySelectorAll('img').forEach(function (img) {
      img.style.setProperty('max-width', '100%', 'important');
      img.style.setProperty('height', 'auto', 'important');
    });

    var serialized = new XMLSerializer().serializeToString(clone);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
      '<foreignObject x="0" y="0" width="' + width + '" height="' + height + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;background:#fff;width:' + width + 'px;height:' + height + 'px;overflow:hidden;">' + serialized + '</div>' +
      '</foreignObject></svg>';

    var dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    var image = await loadImage(dataUrl);
    var scale = 2;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function inlineStyles(source, target) {
    var sources = [source].concat(Array.prototype.slice.call(source.querySelectorAll('*')));
    var targets = [target].concat(Array.prototype.slice.call(target.querySelectorAll('*')));
    var props = [
      'display','box-sizing','width','height','min-width','min-height','max-width','max-height','margin','padding',
      'border','border-top','border-right','border-bottom','border-left','border-collapse','border-spacing','border-radius',
      'background','background-color','color','font','font-family','font-size','font-weight','font-style','line-height',
      'letter-spacing','text-align','text-decoration','text-transform','white-space','vertical-align','list-style','list-style-type',
      'overflow','float','clear','position','left','top','right','bottom','opacity','object-fit','object-position'
    ];
    sources.forEach(function (node, index) {
      var copy = targets[index];
      if (!copy) return;
      var style = window.getComputedStyle(node);
      props.forEach(function (prop) {
        try { copy.style.setProperty(prop, style.getPropertyValue(prop), style.getPropertyPriority(prop)); } catch (_) {}
      });
      copy.style.transform = 'none';
      copy.style.animation = 'none';
      copy.style.transition = 'none';
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('No se pudo renderizar la hoja como imagen.')); };
      image.src = src;
    });
  }

  function canvasToJpegSlices(canvas) {
    var pdfW = 612;
    var pdfH = 792;
    var sliceH = Math.max(1, Math.round(canvas.width * (pdfH / pdfW)));
    var result = [];
    for (var y = 0; y < canvas.height; y += sliceH) {
      var h = Math.min(sliceH, canvas.height - y);
      var slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      var ctx = slice.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, slice.width, h);
      result.push({ dataUrl: slice.toDataURL('image/jpeg', 0.96), width: slice.width, height: slice.height });
    }
    return result;
  }

  function buildPdf(slices) {
    var pdfW = 612, pdfH = 792;
    var objects = [];
    function add(bytes) { objects.push(bytes); return objects.length; }
    function ascii(str) {
      var out = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 255;
      return out;
    }
    function dataUrlBytes(url) {
      var raw = atob(url.split(',')[1] || '');
      var out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 255;
      return out;
    }

    var imageRefs = slices.map(function (slice) {
      var img = dataUrlBytes(slice.dataUrl);
      var head = ascii('<< /Type /XObject /Subtype /Image /Width ' + slice.width + ' /Height ' + slice.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n');
      var foot = ascii('\nendstream');
      var obj = new Uint8Array(head.length + img.length + foot.length);
      obj.set(head, 0); obj.set(img, head.length); obj.set(foot, head.length + img.length);
      return add(obj);
    });

    var pageRefs = imageRefs.map(function (imgRef, i) {
      var slice = slices[i];
      var drawH = Math.min(pdfH, pdfW * (slice.height / slice.width));
      var y = pdfH - drawH;
      var stream = 'q\n' + pdfW + ' 0 0 ' + drawH.toFixed(2) + ' 0 ' + y.toFixed(2) + ' cm\n/Im' + (i + 1) + ' Do\nQ';
      var contentRef = add(ascii('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream'));
      return add(ascii('<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ' + pdfW + ' ' + pdfH + '] /Resources << /XObject << /Im' + (i + 1) + ' ' + imgRef + ' 0 R >> >> /Contents ' + contentRef + ' 0 R >>'));
    });

    var pagesRef = add(ascii('<< /Type /Pages /Kids [' + pageRefs.map(function (r) { return r + ' 0 R'; }).join(' ') + '] /Count ' + pageRefs.length + ' >>'));
    pageRefs.forEach(function (ref) {
      var txt = Array.prototype.map.call(objects[ref - 1], function (b) { return String.fromCharCode(b); }).join('');
      objects[ref - 1] = ascii(txt.replace('/Parent 0 0 R', '/Parent ' + pagesRef + ' 0 R'));
    });
    var catalogRef = add(ascii('<< /Type /Catalog /Pages ' + pagesRef + ' 0 R >>'));

    var chunks = [], offsets = [0], length = 0;
    function push(bytes) { chunks.push(bytes); length += bytes.length; }
    push(ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    objects.forEach(function (obj, i) { offsets.push(length); push(ascii((i + 1) + ' 0 obj\n')); push(obj); push(ascii('\nendobj\n')); });
    var xref = length;
    var trailer = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (var i = 1; i < offsets.length; i++) trailer += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    trailer += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogRef + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    push(ascii(trailer));

    var pdf = new Uint8Array(length), pos = 0;
    chunks.forEach(function (chunk) { pdf.set(chunk, pos); pos += chunk.length; });
    return new Blob([pdf], { type: 'application/pdf' });
  }

  function fallbackPdfFromHtmlText(originalError) {
    try {
      var page = document.getElementById('page');
      var text = page ? (page.innerText || '').trim() : '';
      var blob = buildSimpleTextPdf(text || 'Documento en blanco');
      downloadBlob(blob, getDocumentName() + '.pdf');
      setStatus('PDF descargado con modo de respaldo: ' + getDocumentName() + '.pdf');
    } catch (fallbackError) {
      console.error(originalError, fallbackError);
      setStatus('No se pudo generar el PDF.');
      alert('No se pudo generar el PDF. Revisa que el documento no contenga elementos externos bloqueados por el navegador.');
    }
  }

  function buildSimpleTextPdf(text) {
    var safe = String(text).replace(/[()\\]/g, '\\$&').split(/\n+/).slice(0, 48);
    var stream = 'BT\n/F1 11 Tf\n72 735 Td\n' + safe.map(function (line, i) { return (i ? '0 -15 Td\n' : '') + '(' + line.slice(0, 90) + ') Tj'; }).join('\n') + '\nET';
    var objs = [
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
      '<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 1 0 R >> >> /Contents 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Catalog /Pages 4 0 R >>'
    ];
    var pdf = '%PDF-1.4\n', offsets = [0];
    objs.forEach(function (obj, i) { offsets.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n'; });
    var xref = pdf.length;
    pdf += 'xref\n0 6\n0000000000 65535 f \n';
    for (var i = 1; i < offsets.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    pdf += 'trailer\n<< /Size 6 /Root 5 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    var bytes = new Uint8Array(pdf.length);
    for (var j = 0; j < pdf.length; j++) bytes[j] = pdf.charCodeAt(j) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function getDocumentName() {  
    return 'Renombra tu archivo--- Actividad1_TuNombre_TuApellido';  
  }

  function safeFileName(name) {
    return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Documento1 - Word';
  }

  function setStatus(message) {
    var status = document.getElementById('status');
    if (status) status.textContent = message;
  }
})();


;/* ===== samuel-backstage-toggle-fixes-js ===== */

(function () {
  function ready(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }

  ready(function () {
    normalizeBackstageArrow();
    installRetractableSaveAs();
  });

  function normalizeBackstageArrow() {
    var backstage = document.getElementById('backstage');
    var menu = document.querySelector('#backstage .backstage-menu');
    if (!backstage || !menu) return;

    var arrow = menu.querySelector('.samuel-back-arrow, .back-arrow');
    if (!arrow) {
      arrow = document.createElement('button');
      menu.insertBefore(arrow, menu.firstChild);
    }

    arrow.type = 'button';
    arrow.className = 'samuel-back-arrow';
    arrow.textContent = '→';
    arrow.title = 'Volver al documento';
    arrow.setAttribute('aria-label', 'Volver al documento');
    arrow.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      backstage.hidden = true;
      closeSaveAsPanel();
    };
  }

  function installRetractableSaveAs() {
    var backstage = document.getElementById('backstage');
    var saveAsButton = document.querySelector('#backstage .backstage-menu [data-backstage="saveAs"]');
    if (!backstage || !saveAsButton) return;

    saveAsButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      var panel = document.getElementById('backstage-saveAs');
      if (!panel) return;

      var isOpen = panel.classList.contains('active');
      if (isOpen) {
        closeSaveAsPanel();
      } else {
        document.querySelectorAll('#backstage .backstage-panel').forEach(function (item) {
          item.classList.remove('active');
        });
        document.querySelectorAll('#backstage .backstage-menu button').forEach(function (button) {
          button.classList.remove('back-active', 'samuel-saveas-open');
        });
        panel.classList.add('active');
        saveAsButton.classList.add('back-active', 'samuel-saveas-open');
      }
    }, true);
  }

  function closeSaveAsPanel() {
    var saveAsPanel = document.getElementById('backstage-saveAs');
    var infoPanel = document.getElementById('backstage-info');
    var saveAsButton = document.querySelector('#backstage .backstage-menu [data-backstage="saveAs"]');
    if (saveAsPanel) saveAsPanel.classList.remove('active');
    if (saveAsButton) saveAsButton.classList.remove('back-active', 'samuel-saveas-open');
    /* Mostrar Información como estado base para que la lista de formatos quede oculta. */
    document.querySelectorAll('#backstage .backstage-panel').forEach(function (item) {
      if (item !== infoPanel) item.classList.remove('active');
    });
    if (infoPanel) infoPanel.classList.add('active');
  }
})();


;/* ===== samuel-section-one-clean-view-script ===== */

(function () {
  function applyCleanView() {
    var title = document.getElementById('documentTitle');
    if (title) title.value = 'Sección 1';

    var infoName = document.getElementById('infoName');
    if (infoName) infoName.textContent = 'Sección 1';

    var header = document.getElementById('headerArea');
    if (header) header.innerHTML = '';

    var footer = document.getElementById('footerArea');
    if (footer) footer.innerHTML = '';
    ['headerArea2', 'footerArea2', 'headerArea3', 'footerArea3'].forEach(function (id) {
      var extraArea = document.getElementById(id);
      if (extraArea) extraArea.innerHTML = '';
    });

    var page = document.getElementById('page');
    if (page) {
      page.style.width = '816px';
      page.style.minHeight = '1056px';
      page.style.background = '#ffffff';
      page.classList.add('samuel-pdf-page');
      page.setAttribute('data-section', '1');
    }
    ['page2', 'page3'].forEach(function (id) {
      var sectionPage = document.getElementById(id);
      if (sectionPage) {
        sectionPage.style.width = '816px';
        sectionPage.style.minHeight = '1056px';
        sectionPage.style.background = '#ffffff';
        sectionPage.classList.add('samuel-pdf-page', 'section-page');
      }
    });
    var pagesCounter = document.getElementById('pages');
    if (pagesCounter) pagesCounter.textContent = '3';
    var pageStatus = document.getElementById('pageStatus');
    if (pageStatus) pageStatus.textContent = 'Página 1 de 3';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyCleanView();
      setTimeout(applyCleanView, 250);
    });
  } else {
    applyCleanView();
    setTimeout(applyCleanView, 250);
  }
})();


;/* ===== samuel-tutorial-floating-messages-js ===== */


(function () {
  'use strict';

  var state = 'init';
  var activeSection = 1;
  var editor, boldButton, italicButton, colorButton, bulletButton, textPalette, institutionalColorButton;
  var currentTip = null;
  var highlighted = null;
  var paragraphHtml = '';
  var paragraphText = '';
  var firstTipDismissedAt = 0;
  var paragraphSecondTipTimer = null;
  var debounceTimer = null;
  var firstGoalLi = null;
  var secondGoalLi = null;
  var finishButton = null;
  var section2CellTipShown = false;
  var section2ButtonTip = null;
  var section3ButtonTip = null;
  var section3ImageInserted = false;
  var section3Observer = null;
  var finalFlowReady = false;
  var finalSubmitButton = null;
  var finalPdfSelected = false;
  var TITLE_DEBOUNCE = 700;
  var GOAL_DEBOUNCE = 650;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    editor = document.getElementById('editor');
    if (!editor || window.__samuelTutorialInstalled) return;
    window.__samuelTutorialInstalled = true;
    boldButton = document.querySelector('[data-cmd="bold"]');
    italicButton = document.querySelector('[data-cmd="italic"]');
    colorButton = document.querySelector('[data-action="toggleTextPalette"]');
    bulletButton = document.querySelector('[data-cmd="insertUnorderedList"]');
    textPalette = document.getElementById('textPalette');
    institutionalColorButton = document.querySelector('#textPalette .theme-color-grid [data-color="#0068FF"]') || document.querySelector('#textPalette [data-color="#0068FF"]');
    ensureOverlay();
    ensureFinishButton();
    normalizeEditor();
    showInitialTip();
    editor.addEventListener('mousedown', hideFirstTipAndStartClock, true);
    editor.addEventListener('focus', function () {
      if (state === 'init') showTip('Redacta un párrafo de 3 a 4 líneas donde expliques por qué elegiste esta carrera.', initialCaretRect(), { position: 'right' });
    }, true);
    editor.addEventListener('keydown', handleEditorKeydown, true);
    editor.addEventListener('input', handleEditorInput, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('click', handleSection2TableClick, true);
    document.addEventListener('click', handleSection3FlowClick, true);
    document.addEventListener('click', handleFinalSubmissionFlowClick, true);
    document.addEventListener('input', handleSection2CellTyping, true);
    document.addEventListener('change', handleFinalPdfSelection, true);
    document.addEventListener('click', handleFinalPdfSelection, true);
    var imageInput = document.getElementById('imageOpen');
    if (imageInput) imageInput.addEventListener('change', handleSection3ImageInputChange, true);
    observeSection3Images();
    window.addEventListener('resize', function () { repositionCurrentTip(); placeSection2ButtonTip(); placeSection3ButtonTip(); });
    window.addEventListener('scroll', function () { repositionCurrentTip(); placeSection2ButtonTip(); placeSection3ButtonTip(); }, true);
  });

  function normalizeEditor() {
    if (!editor.textContent.trim()) editor.innerHTML = '<div><br></div>';
  }

  function ensureOverlay() {
    if (document.getElementById('samuelTutorialCompleteOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'samuelTutorialCompleteOverlay';
    overlay.innerHTML = '<div class="samuel-complete-card"><p class="samuel-complete-title"><span style="color:#2A6AFF;">¡Felicidades!</span><br>Aprendiste a manipular fuentes, uso de color, aplicación de cursiva, creación de listas con viñetas y redacción sintética.</p><button class="samuel-next-button" type="button">Pasar a la siguiente sección</button></div>';
    document.body.appendChild(overlay);
    attachOverlayMouseAudio(overlay, 'audios/P2.mp3');
    var nextButton = overlay.querySelector('.samuel-next-button');
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        overlay.classList.remove('is-visible');
        switchToSection(2);
      });
    }
  }


  function switchToSection(sectionNumber) {
    activeSection = sectionNumber;
    clearTip();
    removeSection2ButtonTip();
    removeSection3ButtonTip();
    if (finishButton) finishButton.hidden = true;

    var targetPage = sectionNumber === 1 ? document.getElementById('page') : document.getElementById('page' + sectionNumber);
    var targetEditor = sectionNumber === 1 ? document.getElementById('editor') : document.getElementById('editor' + sectionNumber);
    if (!targetPage || !targetEditor) return;

    var previousEditor = editor || document.getElementById('editor');
    if (previousEditor && previousEditor !== targetEditor) {
      previousEditor.setAttribute('contenteditable', 'false');
      previousEditor.setAttribute('aria-readonly', 'true');
    }

    editor = targetEditor;
    editor.setAttribute('contenteditable', 'true');
    editor.removeAttribute('aria-readonly');
    state = sectionNumber === 1 ? 'section1-ready' : 'section' + sectionNumber + '-ready';
    paragraphHtml = '';
    paragraphText = '';
    firstTipDismissedAt = 0;
    paragraphSecondTipTimer = null;
    clearTimeout(debounceTimer);

    var title = document.getElementById('documentTitle');
    if (title) title.value = 'Sección ' + sectionNumber;
    var infoName = document.getElementById('infoName');
    if (infoName) infoName.textContent = 'Sección ' + sectionNumber;
    var pageStatus = document.getElementById('pageStatus');
    if (pageStatus) pageStatus.textContent = 'Página ' + sectionNumber + ' de 3';

    targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (sectionNumber === 2) {
      section2CellTipShown = false;
      setTimeout(function () { showSection2IntroTip(); focusEnd(editor); }, 450);
    } else if (sectionNumber === 3) {
      section3ImageInserted = false;
      state = 'section3-intro';
      setTimeout(function () { showSection3IntroTip(); focusEnd(getSection3ImageArea() || editor); }, 450);
    } else {
      setTimeout(function () {
        focusEnd(editor);
        if (sectionNumber === 1 && finalFlowReady) {
          finalFlowReady = false;
          state = 'final-intro';
          showFinalIntroTip();
        }
      }, 350);
    }
  }

  function ensureSection2Overlay() {
    if (document.getElementById('samuelTutorialSection2Overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'samuelTutorialSection2Overlay';
    overlay.innerHTML = '<div class="samuel-complete-card"><p class="samuel-complete-title"><span style="color:#FF7D01;">¡Bien hecho!</span><br>Hoy aprendiste a editar tablas en <span style="color:#2A6AFF;">Word</span>, organizar información en filas y columnas, y apropiarte del modelo flexible andragógico.</p><button class="samuel-next-button" type="button">Pasar a la siguiente sección</button></div>';
    document.body.appendChild(overlay);
    attachOverlayMouseAudio(overlay, 'audios/P3.mp3');
    var nextButton = overlay.querySelector('.samuel-next-button');
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        overlay.classList.remove('is-visible');
        switchToSection(3);
      });
    }
  }

  function showSection2CompletionOverlay() {
    ensureSection2Overlay();
    var overlay = document.getElementById('samuelTutorialSection2Overlay');
    if (overlay) overlay.classList.add('is-visible');
  }

  function showSection2IntroTip() {
    var table = document.querySelector('#editor2 .weekly-budget-table');
    if (!table) return;
    showTip('Haz clic dentro de cada celda y completa tus horarios, coloca la frase: Trabajo, Familia o Estudio, según el tiempo que le destines a lo largo de tu semana (puedes colocar una frase o las tres en cada celda), si no aplica, deja la celda en blanco.', table, { position: 'table-top' });
  }

  function handleSection2TableClick(event) {
    if (activeSection !== 2 || section2CellTipShown) return;
    var cell = event.target.closest && event.target.closest('#editor2 .weekly-budget-table td:not(.budget-time-cell)');
    if (!cell) return;
    section2CellTipShown = true;
    clearTip();
    showTip('Escribe: Trabajo, Familia o Estudio según corresponda, (da Enter ↲ para separar entre frases)', section2TitleEndRect() || cell, { position: 'right' });
    if (finishButton) finishButton.hidden = false;
    showSection2ButtonTip();
  }

  function handleSection2CellTyping(event) {
    if (activeSection !== 2) return;
    var cell = event.target.closest && event.target.closest('#editor2 .weekly-budget-table td:not(.budget-time-cell)');
    if (!cell) return;
    if (currentTip && currentTip.node && currentTip.node.textContent.indexOf('Escribe: Trabajo, Familia o Estudio') === 0) {
      clearTip();
    }
  }

  function section2TitleEndRect() {
    var title = document.querySelector('#editor2 .section-two-budget-title');
    if (!title) return null;
    try {
      var range = document.createRange(); range.selectNodeContents(title); range.collapse(false);
      var rect = range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return { left: rect.right, right: rect.right + 1, top: rect.top, bottom: rect.bottom, width: 1, height: Math.max(18, rect.height || 18) };
    } catch (_) {}
    var fallback = title.getBoundingClientRect();
    return { left: fallback.right, right: fallback.right + 1, top: fallback.top, bottom: fallback.bottom, width: 1, height: Math.max(18, fallback.height || 18) };
  }
  function showSection2ButtonTip() {
    if (!finishButton) return;
    removeSection2ButtonTip();
    var tip = document.createElement('div');
    tip.className = 'samuel-tutorial-tip is-visible';
    tip.textContent = 'Cuándo termines da clic aquí';
    document.body.appendChild(tip);
    section2ButtonTip = tip;
    placeSection2ButtonTip();
  }

  function placeSection2ButtonTip() {
    if (!section2ButtonTip || !finishButton || finishButton.hidden) return;
    var rect = finishButton.getBoundingClientRect();
    var width = section2ButtonTip.offsetWidth || 220;
    var height = section2ButtonTip.offsetHeight || 42;
    var left = rect.left + (rect.width / 2) - (width / 2);
    var top = rect.top - height - 10;
    section2ButtonTip.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + 'px';
    section2ButtonTip.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
  }

  function removeSection2ButtonTip() {
    if (section2ButtonTip) {
      section2ButtonTip.remove();
      section2ButtonTip = null;
    }
  }


  function ensureSection3Overlay() {
    if (document.getElementById('samuelTutorialSection3Overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'samuelTutorialSection3Overlay';
    overlay.innerHTML = '<div class="samuel-complete-card"><p class="samuel-complete-title"><span style="color:#FF7D01;">¡Buen trabajo!</span><br>Hoy aprendiste a insertar imágenes de manera correcta en <span style="color:#2A6AFF;">Word</span>, además de cumplir con la interacción en el Entorno Virtual de Aprendizaje.</p><button class="samuel-next-button" type="button">Pasar a la siguiente sección</button></div>';
    document.body.appendChild(overlay);
    attachOverlayMouseAudio(overlay, 'audios/P4.mp3');
    var nextButton = overlay.querySelector('.samuel-next-button');
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        overlay.classList.remove('is-visible');
        finalFlowReady = true;
        switchToSection(1);
      });
    }
  }

  function showSection3CompletionOverlay() {
    ensureSection3Overlay();
    var overlay = document.getElementById('samuelTutorialSection3Overlay');
    if (overlay) overlay.classList.add('is-visible');
  }

  function getSection3ImageArea() {
    return document.querySelector('#editor3 [data-samuel-role="section3-image-area"]') || document.getElementById('editor3');
  }

  function showSection3IntroTip() {
    var target = getSection3ImageArea() || document.getElementById('page3');
    showTip('Aquí, insertarás la captura de pantalla que tomaste de tu parcipación en el Foro de Bienvenida, sigue los siguientes pasos para hacerlo correctamente (da clic en la zona en blanco para comenzar)', target, { position: 'above' });
  }

  function handleSection3FlowClick(event) {
    if (activeSection !== 3) return;
    var target = event.target;
    if (state === 'section3-intro') {
      if (target.closest && target.closest('#page3')) {
        clearTip();
        state = 'section3-insert-tab';
        var insertTab = document.querySelector('[data-tab="insertar"]');
        if (insertTab) showTip('Da clic en esta pestaña', insertTab, { position: 'above', highlight: true });
      }
      return;
    }
    if (state === 'section3-insert-tab' && target.closest && target.closest('[data-tab="insertar"]')) {
      clearTip();
      nextFrame(function () {
        state = 'section3-image-button';
        var imageButton = document.querySelector('[data-action="image"]');
        if (imageButton) showTip('Da clic para seleccionar tu captura de pantalla', imageButton, { position: 'above', highlight: true });
      });
      return;
    }
    if (state === 'section3-image-button' && target.closest && target.closest('[data-action="image"]')) {
      clearTip();
      state = 'section3-waiting-image';
      setTimeout(verifySection3ImageInserted, 700);
    }
  }

  function handleSection3ImageInputChange() {
    if (activeSection !== 3) return;
    setTimeout(verifySection3ImageInserted, 700);
    setTimeout(verifySection3ImageInserted, 1400);
  }

  function observeSection3Images() {
    var section3Editor = document.getElementById('editor3');
    if (!section3Editor || section3Observer) return;
    section3Observer = new MutationObserver(function () {
      if (activeSection === 3) verifySection3ImageInserted();
    });
    section3Observer.observe(section3Editor, { childList: true, subtree: true });
  }

  function verifySection3ImageInserted() {
    if (activeSection !== 3 || section3ImageInserted) return;
    var section3Editor = document.getElementById('editor3');
    if (!section3Editor || !section3Editor.querySelector('img')) return;
    section3ImageInserted = true;
    clearTip();
    ensureFinishButton();
    if (finishButton) finishButton.hidden = false;
    showSection3ButtonTip();
    state = 'section3-finish-click';
  }

  function showSection3ButtonTip() {
    if (!finishButton) return;
    removeSection3ButtonTip();
    var tip = document.createElement('div');
    tip.className = 'samuel-tutorial-tip is-visible';
    tip.textContent = 'Si ya insertaste la imagen da clic aquí';
    document.body.appendChild(tip);
    section3ButtonTip = tip;
    placeSection3ButtonTip();
  }

  function placeSection3ButtonTip() {
    if (!section3ButtonTip || !finishButton || finishButton.hidden) return;
    var rect = finishButton.getBoundingClientRect();
    var width = section3ButtonTip.offsetWidth || 230;
    var height = section3ButtonTip.offsetHeight || 42;
    var left = rect.left + (rect.width / 2) - (width / 2);
    var top = rect.top - height - 10;
    section3ButtonTip.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + 'px';
    section3ButtonTip.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
  }

  function removeSection3ButtonTip() {
    if (section3ButtonTip) {
      section3ButtonTip.remove();
      section3ButtonTip = null;
    }
  }

  function showFinalIntroTip() {
    var target = document.getElementById('page') || document.getElementById('editor') || document.body;
    showTip('¡Excelente trabajo!, has completado tu primer kit digital! Para enviar tu actividad, sigue estos sencillos pasos (da clic en la zona en blanco para comenzar)', target, { position: 'above' });
  }

  function handleFinalSubmissionFlowClick(event) {
    var target = event.target;
    if (state === 'final-intro') {
      clearTip();
      state = 'final-archivo-tab';
      var archivoTab = document.querySelector('[data-tab="archivo"]');
      if (archivoTab) showTip('Da clic para acceder a las opciones de guardado', archivoTab, { position: 'above', highlight: true });
      return;
    }
    if (state === 'final-archivo-tab' && target.closest && target.closest('[data-tab="archivo"]')) {
      clearTip();
      nextFrame(function () {
        state = 'final-guardar-como';
        var saveAsButton = document.querySelector('#backstage .backstage-menu [data-backstage="saveAs"]');
        if (saveAsButton) showTip('Da clic para seleccionar una forma de guardado', saveAsButton, { position: 'right', highlight: true });
      });
      return;
    }
    if (state === 'final-guardar-como' && target.closest && target.closest('#backstage .backstage-menu [data-backstage="saveAs"]')) {
      clearTip();
      nextFrame(function () {
        state = 'final-pdf-option';
        showTip('Selecciona "Documento de Word" o "PDF" para guardar tu trabajo realizado', getPdfOptionRect(), { position: 'above' });
      });
    }
  }

  function getPdfOptionRect() {

var select = document.getElementById('saveAsFormat');

if (!select) return document.getElementById('backstage-saveAs') || document.body;

 

var rect = select.getBoundingClientRect();

 

return {

left: rect.left,

right: rect.right,

top: rect.top,

bottom: rect.top + 1,

width: rect.width,

height: 1

};

}

  function handleFinalPdfSelection(event) {
    if (state !== 'final-pdf-option') return;
    var select = event.target && (event.target.id === 'saveAsFormat' ? event.target : (event.target.closest && event.target.closest('#saveAsFormat')));
    if (!select || (select.value !== 'pdf' && select.value !== 'docx')) return;
    finalPdfSelected = true;
    clearTip();
    state = 'final-ready-to-finish';
    setTimeout(function () { showFinalSubmitButton(); }, 500);
  }

  function showFinalSubmitButton() {
    if (state !== 'final-ready-to-finish') return;
    if (!finalSubmitButton) {
      finalSubmitButton = document.createElement('button');
      finalSubmitButton.id = 'samuelFinalSubmitButton';
      finalSubmitButton.type = 'button';
      finalSubmitButton.textContent = 'Terminar';
      finalSubmitButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        finalSubmitButton.hidden = true;
        showFinalDeliveryOverlay();
      });
      document.body.appendChild(finalSubmitButton);
    }
    finalSubmitButton.hidden = false;
  }

  function ensureFinalDeliveryOverlay() {
    if (document.getElementById('samuelFinalDeliveryOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'samuelFinalDeliveryOverlay';
    overlay.innerHTML = '<div class="samuel-confetti-layer" aria-hidden="true"></div><div class="samuel-final-card"><p class="samuel-final-message">Regresa a tu curso de Inducción en <strong data-lexical-text="true" class="samuel-blue-text">Blackboard Ultra</strong>, entra al espacio correspondiente de la <strong data-lexical-text="true" class="samuel-orange-text">Actividad 1</strong>, adjunta tu archivo guardado y presiona el botón <strong data-lexical-text="true" class="samuel-white-text">Enviar</strong>.<em class="___11wyd0v f1j4dglz" data-lexical-text="true"> Tu tutor recibirá tu entrega y liberará tus primeros puntos de la calificación.</em></p><button class="samuel-exit-button" type="button">Salir</button></div>';
    document.body.appendChild(overlay);
    attachOverlayMouseAudio(overlay, 'audios/P5.mp3');
    createSlowConfetti(overlay.querySelector('.samuel-confetti-layer'));
    var exitButton = overlay.querySelector('.samuel-exit-button');
    if (exitButton) {
      exitButton.addEventListener('click', function () {
        closeSimulatorAutomatically();
      });
    }
  }

  function createSlowConfetti(layer) {
    if (!layer) return;
    var colors = ['#2A6AFF', '#FF8500', '#FFFFFF', '#D9D9D9'];
    for (var i = 0; i < 72; i++) {
      var piece = document.createElement('span');
      piece.className = 'samuel-confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = (12 + Math.random() * 10) + 's';
      piece.style.animationDelay = (-Math.random() * 18) + 's';
      piece.style.setProperty('--samuel-drift', ((Math.random() * 140) - 70) + 'px');
      piece.style.transform = 'rotate(' + Math.floor(Math.random() * 180) + 'deg)';
      layer.appendChild(piece);
    }
  }

  function playFinalSound() {
    try { var sound = new Audio('audios/final.mp3'); sound.preload = 'auto'; sound.currentTime = 0; var promise = sound.play(); if (promise && promise.catch) promise.catch(function () {}); } catch (_) {}
  }
  function showFinalDeliveryOverlay() {
    ensureFinalDeliveryOverlay();
    var overlay = document.getElementById('samuelFinalDeliveryOverlay');
    if (overlay) { overlay.classList.add('is-visible'); playFinalSound(); }
  }

  function closeSimulatorAutomatically() {
    window.close();
    setTimeout(function () {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:32px;"><div><h1 style="font-weight:400;">Simulador cerrado</h1><p>Puedes cerrar esta pestaña.</p></div></div>';
    }, 250);
  }

  function ensureFinishButton() {
    if (document.getElementById('samuelTutorialFinishButton')) {
      finishButton = document.getElementById('samuelTutorialFinishButton');
      return;
    }
    finishButton = document.createElement('button');
    finishButton.id = 'samuelTutorialFinishButton';
    finishButton.type = 'button';
    finishButton.textContent = 'Terminar';
    finishButton.hidden = true;
    finishButton.addEventListener('click', function () {
      clearTip();
      removeSection2ButtonTip();
      removeSection3ButtonTip();
      finishButton.hidden = true;
      state = 'complete';
      if (activeSection === 2) {
        showSection2CompletionOverlay();
      } else if (activeSection === 3) {
        showSection3CompletionOverlay();
      } else {
        showCompletionOverlay();
      }
    });
    document.body.appendChild(finishButton);
  }

  function showTip(message, target, opts) {
    opts = opts || {};
    clearTip();
    var tip = document.createElement('div');
    tip.className = 'samuel-tutorial-tip';
    tip.textContent = message;
    document.body.appendChild(tip);
    currentTip = { node: tip, target: target, opts: opts };
    placeTip();
    requestAnimationFrame(function () { tip.classList.add('is-visible'); });
    if (opts.highlight && target && target.nodeType === 1) {
      highlighted = target;
      highlighted.classList.add('samuel-tutorial-highlight');
    }
  }

  function clearTip() {
    if (currentTip && currentTip.node) currentTip.node.remove();
    currentTip = null;
    if (highlighted) highlighted.classList.remove('samuel-tutorial-highlight');
    highlighted = null;
  }

  function nextFrame(fn) {
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }
  function attachOverlayMouseAudio(overlay, fileName) {
    if (!overlay || !fileName || overlay.__samuelSoundIconInstalled) return;
    overlay.__samuelSoundIconInstalled = true;
    var overlayAudio = new Audio(fileName);
    overlayAudio.preload = 'auto';
    var soundBlocked = false;
    function stopOverlayAudio() { try { overlayAudio.pause(); overlayAudio.currentTime = 0; } catch (_) {} }
    function playOverlayAudio(event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      if (soundBlocked) return;
      try { overlayAudio.pause(); overlayAudio.currentTime = 0; } catch (_) {}
      var promise = overlayAudio.play();
      if (promise && promise.catch) promise.catch(function () {});
    }
    var icon = document.createElement('div');
    icon.className = 'samuel-sound-icon-wrap';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', 'Da clic para escuchar');
    icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.25v5.5c0 .69.56 1.25 1.25 1.25H8l4.47 3.58c.82.66 2.03.07 2.03-.98V5.4c0-1.05-1.21-1.64-2.03-.98L8 8H4.25C3.56 8 3 8.56 3 9.25Zm13.8-.92a1 1 0 0 0-.1 1.41A3.45 3.45 0 0 1 17.5 12c0 .85-.3 1.66-.8 2.29a1 1 0 1 0 1.56 1.25A5.45 5.45 0 0 0 19.5 12c0-1.36-.5-2.66-1.3-3.77a1 1 0 0 0-1.4.1Zm2.72-2.33a1 1 0 0 0-.09 1.41A6.95 6.95 0 0 1 21 12c0 1.71-.62 3.28-1.65 4.49a1 1 0 0 0 1.52 1.3A8.95 8.95 0 0 0 23 12c0-2.22-.81-4.25-2.14-5.81a1 1 0 0 0-1.34-.19Z"/></svg><span class="samuel-sound-tooltip">Da clic para escuchar</span>';
    icon.addEventListener('click', playOverlayAudio);
    icon.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') playOverlayAudio(event); });
    overlay.appendChild(icon);
    overlay.querySelectorAll('button').forEach(function (button) { button.addEventListener('click', function () { soundBlocked = true; stopOverlayAudio(); }, true); });
    overlay.__samuelStopOverlayAudio = function () { soundBlocked = true; stopOverlayAudio(); };
  }


  function repositionCurrentTip() { if (currentTip) placeTip(); }

  function placeTip() {
    if (!currentTip) return;
    var tip = currentTip.node;
    var rect = getTargetRect(currentTip.target);
    var pos = currentTip.opts.position || 'above';
    tip.classList.toggle('tip-below', pos === 'below');
    tip.classList.toggle('tip-right', pos === 'right');
    tip.classList.toggle('tip-inside-cell', pos === 'inside-cell');
    tip.classList.toggle('section2-table-tip', pos === 'table-top');
    if (pos === 'table-top') tip.style.width = Math.max(220, rect.width) + 'px';
    else tip.style.width = '';
    var width = tip.offsetWidth || 230;
    var height = tip.offsetHeight || 42;
    var left, top;
    if (pos === 'table-top') {
      left = rect.left;
      top = rect.top - height - 12;
      if (top < 8) top = rect.top + 8;
    } else if (pos === 'inside-cell') {
      left = rect.left + (rect.width / 2) - (width / 2);
      top = rect.top + (rect.height / 2) - (height / 2);
    } else if (pos === 'right') {
      left = rect.right + 10;
      top = rect.top + Math.max(0, (rect.height - height) / 2);
    } else if (pos === 'below') {
      left = rect.left;
      top = rect.bottom + 10;
    } else {
      left = rect.left;
      top = rect.top - height - 10;
      if (top < 8) {
        top = rect.bottom + 10;
        tip.classList.add('tip-below');
      }
    }
    tip.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + 'px';
    tip.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
  }

  function getTargetRect(target) {
    if (!target) return { left: window.innerWidth / 2, top: window.innerHeight / 2, right: window.innerWidth / 2, bottom: window.innerHeight / 2, width: 1, height: 1 };
    if (target.getBoundingClientRect) {
      var r = target.getBoundingClientRect();
      if (r && (r.width || r.height)) return r;
    }
    return target;
  }

  function initialCaretRect() {
    focusEnd(editor);
    try {
      var sel = window.getSelection();
      if (sel && sel.rangeCount) {
        var rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect && (rect.width || rect.height)) return rect;
      }
    } catch (_) {}
    var r = editor.getBoundingClientRect();
    var cs = window.getComputedStyle(editor);
    var left = r.left + (parseFloat(cs.paddingLeft) || 0) + 2;
    var top = r.top + (parseFloat(cs.paddingTop) || 0) + 2;
    var lineHeight = parseFloat(cs.lineHeight) || 24;
    return { left: left, right: left + 1, top: top, bottom: top + lineHeight, width: 1, height: lineHeight };
  }

  function firstTextRect() {
    var block = getParagraphBlock();
    if (!block) return editor;
    try {
      var range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(true);
      var rect = range.getBoundingClientRect();
      return rect && (rect.width || rect.height) ? rect : block;
    } catch (_) { return block; }
  }

  function endRectOfElement(element) {
    if (!element) return editor;
    try {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      var lastText = null;
      while (walker.nextNode()) lastText = walker.currentNode;
      var range = document.createRange();
      if (lastText) {
        range.setStart(lastText, lastText.nodeValue.length);
        range.setEnd(lastText, lastText.nodeValue.length);
      } else {
        range.selectNodeContents(element);
        range.collapse(false);
      }
      var rect = range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
      var fallback = element.getBoundingClientRect();
      return {
        left: fallback.right - 2,
        right: fallback.right - 1,
        top: fallback.top,
        bottom: fallback.bottom,
        width: 1,
        height: Math.max(18, fallback.height || 18)
      };
    } catch (_) { return element; }
  }

  function endOfParagraphRect() {
    return endRectOfElement(getParagraphBlock());
  }

  function endOfCurrentListItemRect() {
    return endRectOfElement(getCurrentListItem() || editor);
  }

  function showInitialTip() {
    state = 'init';
    firstTipDismissedAt = 0;
    paragraphSecondTipTimer = null;
    showTip('Da clic en la hoja de Word para comenzar (espacio en blanco)', initialCaretRect(), { position: 'right' });
  }

  function hideFirstTipAndStartClock() {
    if (state !== 'init') return;
    clearTip();
    if (!firstTipDismissedAt) firstTipDismissedAt = Date.now();
    scheduleParagraphSecondTip();
  }

  function scheduleParagraphSecondTip() {
    if (paragraphSecondTipTimer) return;
    var remaining = Math.max(0, 3000 - (Date.now() - firstTipDismissedAt));
    paragraphSecondTipTimer = setTimeout(function () {
      paragraphSecondTipTimer = null;
      if (state !== 'init' && state !== 'paragraph-writing') return;
      if (!editor.innerText.trim()) {
        scheduleParagraphSecondTip();
        return;
      }
      paragraphHtml = editor.innerHTML;
      paragraphText = editor.innerText.trim();
      state = 'paragraph-enter';
      showTip('Cuándo termines presiona Enter ↲ para saltar la línea', firstTextRect(), { position: 'above' });
    }, remaining);
  }

  function handleEditorKeydown(event) {
    if (state === 'paragraph-enter' && event.key === 'Enter') {
      event.preventDefault();
      clearTip();
      createTitleLineAboveParagraph();
      state = 'title-writing';
      showTip('Escribe un titulo apropiado de acuerdo a lo que redactaste', getTitleBlock(), { position: 'above' });
      focusEnd(getTitleBlock());
      return;
    }
    if (state === 'paragraph-final-enter' && event.key === 'Enter') {
      event.preventDefault();
      clearTip();
      placeCaretAfterParagraphAndPrepareList();
      state = 'bullet-click';
      nextFrame(function () { showTip('Da clic para añadir lista y redacta 2 metas que quieres lograr durante tu carrera', bulletButton, { position: 'above', highlight: true }); });
      return;
    }
    if (state === 'first-goal-enter' && event.key === 'Enter') {
      event.preventDefault();
      clearTip();
      ensureSecondBullet();
      state = 'second-goal-writing';
      showTip('Escribe tu segunda meta', getCurrentListItem() || editor, { position: 'above' });
      return;
    }
  }

  function handleEditorInput() {
    if (state === 'init') {
      state = 'paragraph-writing';
      clearTip();
      if (!firstTipDismissedAt) firstTipDismissedAt = Date.now();
      scheduleParagraphSecondTip();
      return;
    }
    if (state === 'paragraph-writing') {
      scheduleParagraphSecondTip();
      return;
    }
    if (state === 'title-writing') {
      clearTip();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (state !== 'title-writing' || !getTitleText()) return;
        state = 'select-title-bold';
        showTip('Selecciona todo el titulo (doble clic izquierdo y arrastra)', getTitleBlock(), { position: 'above' });
      }, TITLE_DEBOUNCE);
      return;
    }
    if (state === 'first-goal-writing') {
      clearTip();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (state !== 'first-goal-writing' || !getCurrentListItemText()) return;
        state = 'first-goal-enter';
        showTip('Cuándo termines da Enter ↲', endOfCurrentListItemRect(), { position: 'above' });
      }, GOAL_DEBOUNCE);
      return;
    }
    if (state === 'second-goal-writing') {
      clearTip();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (state !== 'second-goal-writing' || !getCurrentListItemText()) return;
        state = 'finish-click';
        showFinishPrompt();
      }, GOAL_DEBOUNCE);
    }
  }

  function handleSelectionChange() {
    if (!editor) return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !sel.toString().trim()) return;
    if (state === 'select-title-bold' && selectionInside(getTitleBlock())) {
      clearTip();
      state = 'bold-click';
      showTip('Da clic para aplicar formato de negritas', boldButton, { position: 'above', highlight: true });
      return;
    }
    if (state === 'select-title-color' && selectionInside(getTitleBlock())) {
      clearTip();
      state = 'color-button-click';
      showTip('Da clic', colorButton, { position: 'above', highlight: true });
      return;
    }
    if (state === 'select-important-phrase' && selectionInside(getParagraphBlock())) {
      clearTip();
      state = 'italic-click';
      showTip('Da clic para aplicar Cursiva y destacar tu motivación principal', italicButton, { position: 'above', highlight: true });
    }
  }

  function handleDocumentClick(event) {
    var target = event.target;
    if (state === 'bold-click' && target.closest && target.closest('[data-cmd="bold"]')) {
      clearTip();
      nextFrame(function () {
        selectTitleText();
        state = 'color-button-click';
        showTip('Da clic', colorButton, { position: 'above', highlight: true });
      });
      return;
    }
    if (state === 'color-button-click' && target.closest && target.closest('[data-action="toggleTextPalette"]')) {
      clearTip();
      nextFrame(function () {
        textPalette = document.getElementById('textPalette');
        institutionalColorButton = document.querySelector('#textPalette .theme-color-grid [data-color="#0068FF"]') || document.querySelector('#textPalette [data-color="#0068FF"]');
        if (institutionalColorButton) {
          state = 'institutional-color-click';
          showTip('Da clic para aplicar color institucional', institutionalColorButton, { position: 'above', highlight: true });
        }
      });
      return;
    }
    if (state === 'institutional-color-click' && target.closest && target.closest('#textPalette [data-color="#0068FF"]')) {
      clearTip();
      nextFrame(function () {
        state = 'select-important-phrase';
        showTip('Ve a tu párrafo y selecciona una frase o palabra importante que hayas escrito', getParagraphBlock(), { position: 'above' });
      });
      return;
    }
    if (state === 'italic-click' && target.closest && target.closest('[data-cmd="italic"]')) {
      clearTip();
      nextFrame(function () {
        state = 'paragraph-final-enter';
        focusEnd(getParagraphBlock());
        showTip('Cuándo termines presiona Enter ↲ para saltar la línea', endOfParagraphRect(), { position: 'above' });
      });
      return;
    }
    if (state === 'bullet-click' && target.closest && target.closest('[data-cmd="insertUnorderedList"]')) {
      clearTip();
      nextFrame(function () {
        ensureFirstBullet();
        state = 'first-goal-writing';
        showTip('Escribe tu primer meta', getCurrentListItem() || editor, { position: 'above' });
      });
    }
  }


  function showFinishPrompt() {
    ensureFinishButton();
    if (finishButton) finishButton.hidden = false;
    var target = secondGoalLi || getCurrentListItem() || editor;
    showTip('Cuándo hayas terminado, da clic en el botón Terminar', target, { position: 'below' });
  }

  function createTitleLineAboveParagraph() {
    var titleBlock = document.createElement('div');
    titleBlock.setAttribute('data-samuel-role', 'title');
    titleBlock.innerHTML = '<br>';

    var paragraphBlock = document.createElement('div');
    paragraphBlock.setAttribute('data-samuel-role', 'paragraph');

    while (editor.firstChild) {
      paragraphBlock.appendChild(editor.firstChild);
    }

    if (!paragraphBlock.textContent.trim() && !paragraphBlock.querySelector('img, table, ul, ol')) {
      paragraphBlock.innerHTML = escapeHtml(paragraphText || '') || '<br>';
    }

    paragraphHtml = paragraphBlock.innerHTML;
    paragraphText = paragraphBlock.innerText.trim();

    editor.appendChild(titleBlock);
    editor.appendChild(paragraphBlock);
  }

  function placeCaretAfterParagraphAndPrepareList() {
    var p = getParagraphBlock();
    if (!p) return;
    var spacer = document.createElement('div');
    spacer.setAttribute('data-samuel-role', 'list-anchor');
    spacer.innerHTML = '<br>';
    p.insertAdjacentElement('afterend', spacer);
    focusEnd(spacer);
  }

  function ensureFirstBullet() {
    var list = editor.querySelector('ul[data-samuel-role="goals"]') || editor.querySelector('ul');
    if (!list) {
      var anchor = editor.querySelector('[data-samuel-role="list-anchor"]');
      list = document.createElement('ul');
      list.setAttribute('data-samuel-role', 'goals');
      var li = document.createElement('li');
      li.innerHTML = '<br>';
      list.appendChild(li);
      if (anchor) anchor.replaceWith(list);
      else editor.appendChild(list);
    } else if (!list.querySelector('li')) list.innerHTML = '<li><br></li>';
    firstGoalLi = list.querySelector('li');
    focusEnd(firstGoalLi);
  }

  function ensureSecondBullet() {
    var list = editor.querySelector('ul[data-samuel-role="goals"]') || editor.querySelector('ul');
    if (!list) {
      ensureFirstBullet();
      list = editor.querySelector('ul[data-samuel-role="goals"]') || editor.querySelector('ul');
    }
    var li = document.createElement('li');
    li.innerHTML = '<br>';
    list.appendChild(li);
    secondGoalLi = li;
    focusEnd(li);
  }

  function getTitleBlock() { return editor.querySelector('[data-samuel-role="title"]') || editor.firstElementChild || editor; }
  function getParagraphBlock() { return editor.querySelector('[data-samuel-role="paragraph"]') || editor.children[1] || editor.firstElementChild || editor; }
  function getTitleText() { var t = getTitleBlock(); return t ? t.innerText.trim() : ''; }

  function getCurrentListItem() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
      var node = sel.anchorNode;
      if (node && node.nodeType === 3) node = node.parentNode;
      if (node && node.closest) {
        var li = node.closest('li');
        if (li) return li;
      }
    }
    var items = editor.querySelectorAll('li');
    return items.length ? items[items.length - 1] : null;
  }

  function getCurrentListItemText() {
    var li = getCurrentListItem();
    return li ? li.innerText.trim() : '';
  }

  function selectionInside(container) {
    if (!container) return false;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    var range = sel.getRangeAt(0);
    return container.contains(range.commonAncestorContainer) || container === range.commonAncestorContainer;
  }

  function selectTitleText() {
    var title = getTitleBlock();
    if (!title) return;
    var range = document.createRange();
    range.selectNodeContents(title);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function focusEnd(node) {
    if (!node) return;
    editor.focus();
    var range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function exposeTutorialProgressApi() {
    window.__samuelGetTutorialProgress = function () {
      return {
        state: state,
        activeSection: activeSection,
        firstTipDismissedAt: firstTipDismissedAt,
        section2CellTipShown: section2CellTipShown,
        section3ImageInserted: section3ImageInserted,
        finalFlowReady: finalFlowReady,
        finalPdfSelected: finalPdfSelected
      };
    };
    window.__samuelRestoreTutorialProgress = function (saved) {
      saved = saved || {};
      clearTip();
      removeSection2ButtonTip();
      removeSection3ButtonTip();
      document.querySelectorAll('.samuel-tutorial-tip').forEach(function (tip) { tip.remove(); });
      ['samuelTutorialCompleteOverlay', 'samuelTutorialSection2Overlay', 'samuelTutorialSection3Overlay', 'samuelStartIntroOverlay'].forEach(function (id) {
        var overlay = document.getElementById(id);
        if (overlay) overlay.classList.remove('is-visible');
      });
      activeSection = Number(saved.activeSection || inferSectionFromDocument()) || 1;
      state = saved.state || inferTutorialStateFromDocument(activeSection);
      section2CellTipShown = !!saved.section2CellTipShown;
      section3ImageInserted = !!saved.section3ImageInserted || !!(document.getElementById('editor3') && document.getElementById('editor3').querySelector('img'));
      finalFlowReady = !!saved.finalFlowReady;
      finalPdfSelected = !!saved.finalPdfSelected;
      window.__samuelStartIntroOverlayShown = true;
      restoreSectionWithoutIntro(activeSection);
      setTimeout(function () { showTipForRestoredState(); }, 180);
    };
  }
  exposeTutorialProgressApi();
  function restoreSectionWithoutIntro(sectionNumber) {
    activeSection = sectionNumber;
    var targetEditor = sectionNumber === 1 ? document.getElementById('editor') : document.getElementById('editor' + sectionNumber);
    if (!targetEditor) targetEditor = document.getElementById('editor');
    ['editor', 'editor2', 'editor3'].forEach(function (id) {
      var item = document.getElementById(id);
      if (!item) return;
      if (item === targetEditor) {
        item.setAttribute('contenteditable', 'true');
        item.removeAttribute('aria-readonly');
      } else {
        item.setAttribute('contenteditable', 'false');
        item.setAttribute('aria-readonly', 'true');
      }
    });
    editor = targetEditor;
    var title = document.getElementById('documentTitle');
    if (title) title.value = 'Sección ' + sectionNumber;
    var infoName = document.getElementById('infoName');
    if (infoName) infoName.textContent = 'Sección ' + sectionNumber;
    var pageStatus = document.getElementById('pageStatus');
    if (pageStatus) pageStatus.textContent = 'Página ' + sectionNumber + ' de 3';
    var targetPage = document.getElementById(sectionNumber === 1 ? 'page' : 'page' + sectionNumber);
    if (targetPage && targetPage.scrollIntoView) targetPage.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  function inferSectionFromDocument() {
    var title = document.getElementById('documentTitle');
    var match = title && title.value ? title.value.match(/Secci[oó]n\s+(\d+)/i) : null;
    return match ? parseInt(match[1], 10) : 1;
  }
  function inferTutorialStateFromDocument(sectionNumber) {
    if (sectionNumber === 2) {
      return tableHasStudentText() ? 'section2-finish-click' : 'section2-ready';
    }
    if (sectionNumber === 3) {
      return (document.getElementById('editor3') && document.getElementById('editor3').querySelector('img')) ? 'section3-finish-click' : 'section3-intro';
    }
    if (finalFlowReady) return 'final-intro';
    if (editorHasGoals()) return 'finish-click';
    if (getTitleText && getTitleText()) return 'select-title-bold';
    return editor && editor.innerText.trim() ? 'paragraph-enter' : 'init';
  }
  function tableHasStudentText() {
    var cells = document.querySelectorAll('#editor2 .weekly-budget-table td:not(.budget-time-cell)');
    for (var i = 0; i < cells.length; i++) {
      if ((cells[i].innerText || '').trim()) return true;
    }
    return false;
  }
  function editorHasGoals() {
    var base = document.getElementById('editor');
    return !!(base && base.querySelector('li') && base.querySelector('li').innerText.trim());
  }
  function showTipForRestoredState() {
    clearTip();
    if (finishButton) finishButton.hidden = true;
    if (activeSection === 2) {
      if (state === 'section2-finish-click' || section2CellTipShown || tableHasStudentText()) {
        ensureFinishButton();
        if (finishButton) finishButton.hidden = false;
        showSection2ButtonTip();
      } else {
        showSection2IntroTip();
      }
      return;
    }
    if (activeSection === 3) {
      if (state === 'section3-finish-click' || section3ImageInserted) {
        ensureFinishButton();
        if (finishButton) finishButton.hidden = false;
        showSection3ButtonTip();
      } else if (state === 'section3-insert-tab') {
        var insertTab = document.querySelector('[data-tab="insertar"]');
        if (insertTab) showTip('Da clic en esta pestaña', insertTab, { position: 'above', highlight: true });
      } else if (state === 'section3-image-button') {
        var imageButton = document.querySelector('[data-action="image"]');
        if (imageButton) showTip('Da clic para seleccionar tu captura de pantalla', imageButton, { position: 'above', highlight: true });
      } else {
        showSection3IntroTip();
      }
      return;
    }
    if (state === 'final-intro') { showFinalIntroTip(); return; }
    if (state === 'final-archivo-tab') {
      var archivoTab = document.querySelector('[data-tab="archivo"]');
      if (archivoTab) showTip('Da clic para acceder a las opciones de guardado', archivoTab, { position: 'above', highlight: true });
      return;
    }
    if (state === 'final-guardar-como') {
      var saveAsButton = document.querySelector('#backstage .backstage-menu [data-backstage="saveAs"]');
      if (saveAsButton) showTip('Da clic para seleccionar una forma de guardado', saveAsButton, { position: 'right', highlight: true });
      return;
    }
    if (state === 'final-pdf-option') { showTip('Selecciona "Documento de Word" o "PDF" para guardar tu trabajo realizado', getPdfOptionRect(), { position: 'above' }); return; }
    if (state === 'final-ready-to-finish') { showFinalSubmitButton(); return; }
    if (state === 'finish-click') { showFinishPrompt(); return; }
    if (state === 'second-goal-writing') { showTip('Escribe tu segunda meta', getCurrentListItem() || editor, { position: 'above' }); return; }
    if (state === 'first-goal-enter') { showTip('Cuándo termines da Enter ↲', endOfCurrentListItemRect(), { position: 'above' }); return; }
    if (state === 'first-goal-writing') { showTip('Escribe tu primer meta', getCurrentListItem() || editor, { position: 'above' }); return; }
    if (state === 'bullet-click') { showTip('Da clic para añadir lista y redacta 2 metas que quieres lograr durante tu carrera', bulletButton, { position: 'above', highlight: true }); return; }
    if (state === 'paragraph-final-enter') { showTip('Cuándo termines presiona Enter ↲ para saltar la línea', endOfParagraphRect(), { position: 'above' }); return; }
    if (state === 'italic-click') { showTip('Da clic para aplicar Cursiva y destacar tu motivación principal', italicButton, { position: 'above', highlight: true }); return; }
    if (state === 'select-important-phrase') { showTip('Ve a tu párrafo y selecciona una frase o palabra importante que hayas escrito', getParagraphBlock(), { position: 'above' }); return; }
    if (state === 'institutional-color-click') {
      institutionalColorButton = document.querySelector('#textPalette .theme-color-grid [data-color="#0068FF"]') || document.querySelector('#textPalette [data-color="#0068FF"]');
      if (institutionalColorButton) showTip('Da clic para aplicar color institucional', institutionalColorButton, { position: 'above', highlight: true });
      return;
    }
    if (state === 'color-button-click') { showTip('Da clic', colorButton, { position: 'above', highlight: true }); return; }
    if (state === 'bold-click') { showTip('Da clic para aplicar formato de negritas', boldButton, { position: 'above', highlight: true }); return; }
    if (state === 'select-title-bold') { showTip('Selecciona todo el titulo (doble clic izquierdo y arrastra)', getTitleBlock(), { position: 'above' }); return; }
    if (state === 'title-writing') { showTip('Escribe un titulo apropiado de acuerdo a lo que redactaste', getTitleBlock(), { position: 'above' }); return; }
    if (state === 'paragraph-enter' || state === 'paragraph-writing') { showTip('Cuándo termines presiona Enter ↲ para saltar la línea', firstTextRect(), { position: 'above' }); return; }
    if (state === 'init' && !(editor && editor.innerText.trim())) showInitialTip();
  }
  function showCompletionOverlay() {
    var overlay = document.getElementById('samuelTutorialCompleteOverlay');
    if (overlay) overlay.classList.add('is-visible');
  }
})();



;/* ===== samuel-start-intro-overlay-js ===== */

(function () {
  'use strict';
  function ready(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }
  ready(function () {
    if (window.__samuelStartIntroOverlayShown) return;
    window.__samuelStartIntroOverlayShown = true;
    var overlay = document.createElement('div');
    overlay.id = 'samuelStartIntroOverlay';
    overlay.innerHTML = '<div class="samuel-start-card"><p class="samuel-start-message"><span style="color:#FF7D01;">¡Me entusiasma ver el avance de tu curso!</span><br>Este, es tu primer simulador de trabajo. A medida que completes cada sección, aprenderás a usar Word, organizar tu tiempo de estudio y desenvolverte en este ecosistema de aprendizaje. Al terminar, guardarás este archivo en formato PDF y lo subirás al espacio de la carpeta de evaluación correspondiente a la actividad 1.<br><span style="color:#2A6AFF;">¡Te deseo mucho éxito!</span></p><button class="samuel-start-button" type="button">Iniciar</button></div>';
    document.body.appendChild(overlay);
    var introAudio = new Audio('audios/P1.mp3');
    introAudio.preload = 'auto';
    introAudio.loop = false;
    var introSoundBlocked = false;
    function stopIntroAudio() { try { introAudio.pause(); introAudio.currentTime = 0; } catch (_) {} }
    function playIntroAudio(event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      if (introSoundBlocked) return;
      try { introAudio.pause(); introAudio.currentTime = 0; } catch (_) {}
      var promise = introAudio.play();
      if (promise && promise.catch) promise.catch(function () {});
    }
    var introIcon = document.createElement('div');
    introIcon.className = 'samuel-sound-icon-wrap';
    introIcon.setAttribute('role', 'button');
    introIcon.setAttribute('tabindex', '0');
    introIcon.setAttribute('aria-label', 'Da clic para escuchar');
    introIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.25v5.5c0 .69.56 1.25 1.25 1.25H8l4.47 3.58c.82.66 2.03.07 2.03-.98V5.4c0-1.05-1.21-1.64-2.03-.98L8 8H4.25C3.56 8 3 8.56 3 9.25Zm13.8-.92a1 1 0 0 0-.1 1.41A3.45 3.45 0 0 1 17.5 12c0 .85-.3 1.66-.8 2.29a1 1 0 1 0 1.56 1.25A5.45 5.45 0 0 0 19.5 12c0-1.36-.5-2.66-1.3-3.77a1 1 0 0 0-1.4.1Zm2.72-2.33a1 1 0 0 0-.09 1.41A6.95 6.95 0 0 1 21 12c0 1.71-.62 3.28-1.65 4.49a1 1 0 0 0 1.52 1.3A8.95 8.95 0 0 0 23 12c0-2.22-.81-4.25-2.14-5.81a1 1 0 0 0-1.34-.19Z"/></svg><span class="samuel-sound-tooltip">Da clic para escuchar</span>';
    introIcon.addEventListener('click', playIntroAudio);
    introIcon.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') playIntroAudio(event); });
    overlay.appendChild(introIcon);

    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
    var startButton = overlay.querySelector('.samuel-start-button');
    if (startButton) {
      startButton.addEventListener('click', function () {
        introSoundBlocked = true;
        stopIntroAudio();
        overlay.classList.remove('is-visible');
        setTimeout(function () { overlay.remove(); }, 120);
        var page = document.getElementById('page');
        if (page && page.scrollIntoView) page.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
})();


;/* ===== samuel-button-sound-js ===== */

(function(){'use strict';if(window.__samuelButtonSoundInstalled)return;window.__samuelButtonSoundInstalled=true;function playButtonSound(){try{var sound=new Audio('audios/boton.mp3');sound.preload='auto';sound.currentTime=0;var promise=sound.play();if(promise&&promise.catch)promise.catch(function(){});}catch(_){}}document.addEventListener('click',function(event){var button=event.target&&event.target.closest?event.target.closest('button'):null;if(!button)return;playButtonSound();},false);})();


;/* ===== samuel-progress-docx-update-js ===== */

(function () {
  'use strict';
  var STORAGE_KEY_PREFIX = 'samuel-word-simulator-progress-netlify-v2';
  var LAST_MATRICULA_KEY = 'samuel-word-simulator-last-matricula';
  var REMOTE_PROGRESS_URL = ''; // Netlify/static mode: persistence is local to this browser and this Netlify site origin.
  var currentMatricula = '';
  var localDbReady = null;
  var restoredOnce = false;
  var initialSessionSnapshot = null;
  function ready(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }
  ready(function () {
    activateWordOption();
    captureInitialSessionState();
    lockSimulatorForMatricula();
    showMatriculaOverlay();
    document.addEventListener('click', handleSaveClick, true);
    document.addEventListener('change', handleSaveAsFormatChange, true);
    document.addEventListener('click', handleSaveAsFormatChange, true);
    document.addEventListener('keyup', handleSaveAsFormatChange, true);
  });
  function captureInitialSessionState() {
    var editable = {};
    document.querySelectorAll('[contenteditable="true"], [contenteditable="false"]').forEach(function (node) {
      if (node.id) editable[node.id] = node.innerHTML;
    });
    initialSessionSnapshot = {
      title: 'Sección 1',
      infoName: 'Sección 1',
      infoSaved: 'Sin guardar',
      status: 'Listo',
      pageStatus: 'Página 1 de 3',
      editable: editable
    };
  }
  function resetToInitialSession() {
    if (!initialSessionSnapshot) captureInitialSessionState();
    document.querySelectorAll('.samuel-tutorial-tip').forEach(function (tip) { tip.remove(); });
    ['samuelSaveProgressTip', 'samuelFinalSubmitButton'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node && node.parentNode) node.remove();
    });
    ['samuelTutorialCompleteOverlay', 'samuelTutorialSection2Overlay', 'samuelTutorialSection3Overlay', 'samuelFinalDeliveryOverlay'].forEach(function (id) {
      var overlay = document.getElementById(id);
      if (overlay) overlay.classList.remove('is-visible');
    });
    Object.keys(initialSessionSnapshot.editable || {}).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.innerHTML = initialSessionSnapshot.editable[id];
    });
    var title = document.getElementById('documentTitle');
    if (title) title.value = initialSessionSnapshot.title;
    var infoName = document.getElementById('infoName');
    if (infoName) infoName.textContent = initialSessionSnapshot.infoName;
    var infoSaved = document.getElementById('infoSaved');
    if (infoSaved) infoSaved.textContent = initialSessionSnapshot.infoSaved;
    var pageStatus = document.getElementById('pageStatus');
    if (pageStatus) pageStatus.textContent = initialSessionSnapshot.pageStatus;
    var status = document.getElementById('status');
    if (status) status.textContent = 'Sesión nueva para matrícula ' + currentMatricula;
    var target = document.getElementById('page');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    var wrap = document.querySelector('.canvas-wrap');
    if (wrap) wrap.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (_) {}
  }
  function normalizeMatricula(value) {
    return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
  }
  function getCurrentStorageKey() {
    return STORAGE_KEY_PREFIX + '::' + encodeURIComponent(currentMatricula || 'sin-matricula');
  }
  function lockSimulatorForMatricula() {
    var app = document.querySelector('.word-app');
    if (app) app.classList.add('samuel-login-locked');
  }
  function unlockSimulatorForMatricula() {
    var app = document.querySelector('.word-app');
    if (app) app.classList.remove('samuel-login-locked');
  }
  function showMatriculaOverlay() {
    var overlay = document.getElementById('samuelMatriculaOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'samuelMatriculaOverlay';
      overlay.innerHTML = '<div class="samuel-matricula-card"><h1>Acceso al simulador</h1><p><b>Ingresa tu matrícula</b> para iniciar o retomar tu avance <b style="color:#FF7D01;">guardado en este navegador</b>.</p><input id="samuelMatriculaInput" type="text" inputmode="text" autocomplete="off" placeholder="al000000" aria-label="Ingresa tu matrícula"><button id="samuelMatriculaContinue" type="button">Entrar</button><div id="samuelMatriculaError" role="alert" aria-live="polite"></div></div>';
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    var input = document.getElementById('samuelMatriculaInput');
    var button = document.getElementById('samuelMatriculaContinue');
    var error = document.getElementById('samuelMatriculaError');
    function submit() {
      var value = normalizeMatricula(input && input.value);
      if (!value) {
        if (error) error.textContent = 'Escribe tu matrícula para continuar.';
        if (input) input.focus();
        return;
      }
      currentMatricula = value;
      window.__samuelCurrentMatricula = currentMatricula;
      restoredOnce = false;
      try { localStorage.setItem(LAST_MATRICULA_KEY, currentMatricula); } catch (_) {}
      if (error) error.textContent = '';
      overlay.hidden = true;
      unlockSimulatorForMatricula();
      restoreProgressSoon();
      var status = document.getElementById('status');
      if (status) status.textContent = 'Sesión iniciada con matrícula ' + currentMatricula;
    }
    if (button && !button.__samuelMatriculaBound) {
      button.__samuelMatriculaBound = true;
      button.addEventListener('click', submit);
    }
    if (input && !input.__samuelMatriculaBound) {
      input.__samuelMatriculaBound = true;
      input.addEventListener('keydown', function (event) { if (event.key === 'Enter') submit(); });
    }
    setTimeout(function () { if (input) { input.value = ''; input.focus(); } }, 60);
  }
  function openLocalProgressDb() {
    if (localDbReady) return localDbReady;
    localDbReady = new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible.'));
      var request = indexedDB.open('samuel-word-simulator-progress-db-v2', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('progressByMatricula')) db.createObjectStore('progressByMatricula');
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('No se pudo abrir IndexedDB.')); };
    });
    return localDbReady;
  }
  async function fetchRemoteProgress() {
    if (!currentMatricula) return null;
    try {
      var db = await openLocalProgressDb();
      return await new Promise(function (resolve, reject) {
        var tx = db.transaction('progressByMatricula', 'readonly');
        var store = tx.objectStore('progressByMatricula');
        var request = store.get(currentMatricula);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error || new Error('No se pudo leer el progreso local.')); };
      });
    } catch (error) {
      console.warn('No se pudo leer IndexedDB. Se usará localStorage como respaldo.', error);
      var raw = localStorage.getItem(getCurrentStorageKey());
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    }
  }
  async function pushRemoteProgress(progress) {
    if (!currentMatricula) return false;
    try {
      var db = await openLocalProgressDb();
      await new Promise(function (resolve, reject) {
        var tx = db.transaction('progressByMatricula', 'readwrite');
        var store = tx.objectStore('progressByMatricula');
        progress.matricula = currentMatricula;
        store.put(progress, currentMatricula);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('No se pudo guardar en IndexedDB.')); };
      });
      return true;
    } catch (error) {
      console.warn('No se pudo guardar en IndexedDB. Ya se intentó respaldo en localStorage.', error);
      return false;
    }
  }
  function activateWordOption() {
    var select = document.getElementById('saveAsFormat');
    if (!select || !select.options || !select.options.length) return;
    var first = select.options[0];
    first.disabled = false;
    first.value = 'docx';
    first.textContent = 'Documento de Word';
    var intro = document.querySelector('#backstage-saveAs p');
    if (intro) intro.innerHTML = 'Selecciona el formato de salida. En esta versión están habilitadas las opciones <b>Documento de Word</b> y <b>PDF</b>.';
    var note = document.querySelector('.save-as-note');
    if (note) note.innerHTML = 'Al elegir <b>Documento de Word</b>, se descargará un archivo editable .docx. Al elegir <b>PDF</b>, el documento se convierte y se descarga automáticamente.';
  }
  function handleSaveClick(event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-action="save"]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (!currentMatricula) {
      showMatriculaOverlay();
      return;
    }
    saveProgress()
      .then(function (remoteSynced) {
        showSavedTip(button, remoteSynced ? 'Tu progreso se ha guardado correctamente para la matrícula ' + currentMatricula + '.' : 'Tu progreso se guardó con respaldo local para la matrícula ' + currentMatricula + '.');
        updateSavedStatus(remoteSynced);
      })
      .catch(function (error) {
        console.error(error);
        showSavedTip(button, 'No se pudo guardar el progreso.');
      });
  }
  function collectProgress() {
    var active = getCurrentSectionNumber();
    var editable = {};
    document.querySelectorAll('[contenteditable="true"], [contenteditable="false"]').forEach(function (node) {
      if (node.id) editable[node.id] = node.innerHTML;
    });
    return {
      version: 2,
      matricula: currentMatricula,
      savedAt: new Date().toISOString(),
      title: getDocumentNameRaw(),
      activeSection: active,
      scrollTop: document.querySelector('.canvas-wrap') ? document.querySelector('.canvas-wrap').scrollTop : 0,
      windowScrollX: window.scrollX || 0,
      windowScrollY: window.scrollY || 0,
      tutorial: (typeof window.__samuelGetTutorialProgress === 'function' ? window.__samuelGetTutorialProgress() : null),
      editable: editable
    };
  }
  async function saveProgress() {
    if (!currentMatricula) throw new Error('No hay matrícula activa.');
    var progress = collectProgress();
    localStorage.setItem(getCurrentStorageKey(), JSON.stringify(progress));
    return await pushRemoteProgress(progress);
  }
  function restoreProgressSoon() {
    setTimeout(function () { restoreProgress(); }, 80);
    setTimeout(function () { restoreProgress(); }, 450);
  }
  function dismissCurrentSessionOverlaysAfterRestore() {
    window.__samuelStartIntroOverlayShown = true;
    ['samuelStartIntroOverlay', 'samuelTutorialCompleteOverlay', 'samuelTutorialSection2Overlay', 'samuelTutorialSection3Overlay', 'samuelFinalDeliveryOverlay'].forEach(function (id) {
      var overlay = document.getElementById(id);
      if (!overlay) return;
      overlay.classList.remove('is-visible');
      overlay.hidden = true;
      if (overlay.__samuelStopOverlayAudio) {
        try { overlay.__samuelStopOverlayAudio(); } catch (_) {}
      }
    });
  }
  async function restoreProgress() {
    if (restoredOnce || !currentMatricula) return;
    var data = await fetchRemoteProgress();
    if (!data) {
      var raw = localStorage.getItem(getCurrentStorageKey());
      if (!raw) {
        resetToInitialSession();
        restoredOnce = true;
        return;
      }
      try { data = JSON.parse(raw); } catch (_) {
        resetToInitialSession();
        restoredOnce = true;
        return;
      }
    } else {
      try { localStorage.setItem(getCurrentStorageKey(), JSON.stringify(data)); } catch (_) {}
    }
    if (!data || !data.editable || (data.matricula && normalizeMatricula(data.matricula) !== currentMatricula)) {
      resetToInitialSession();
      restoredOnce = true;
      return;
    }
    dismissCurrentSessionOverlaysAfterRestore();
    restoredOnce = true;
    Object.keys(data.editable).forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.innerHTML = data.editable[id];
    });
    var title = document.getElementById('documentTitle');
    if (title && data.title) title.value = data.title;
    var infoName = document.getElementById('infoName');
    if (infoName && data.title) infoName.textContent = data.title;
    var section = data.activeSection || sectionFromTitle(data.title) || 1;
    var pageStatus = document.getElementById('pageStatus');
    if (pageStatus) pageStatus.textContent = 'Página ' + section + ' de 3';
    updateSavedStatus(true);
    if (typeof window.__samuelRestoreTutorialProgress === 'function') {
      try { window.__samuelRestoreTutorialProgress(data.tutorial || { activeSection: section }); } catch (error) { console.error(error); }
    }
    setTimeout(function () {
      var target = document.getElementById(section === 1 ? 'page' : 'page' + section);
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'auto', block: 'start' });
      var wrap = document.querySelector('.canvas-wrap');
      if (wrap && typeof data.scrollTop === 'number') wrap.scrollTop = data.scrollTop;
      if (typeof data.windowScrollX === 'number' && typeof data.windowScrollY === 'number') window.scrollTo(data.windowScrollX, data.windowScrollY);
    }, 120);
  }
  function updateSavedStatus(remoteSynced) {
    var where = remoteSynced ? 'guardado en este navegador' : 'guardado con respaldo local';
    var suffix = currentMatricula ? ' para matrícula ' + currentMatricula : '';
    var infoSaved = document.getElementById('infoSaved');
    if (infoSaved) infoSaved.textContent = where + suffix;
    var status = document.getElementById('status');
    if (status) status.textContent = 'Progreso ' + where + suffix;
  }
  function showSavedTip(target, message) {
    message = message || 'Tu progreso se ha guardado con éxito.';
    var old = document.getElementById('samuelSaveProgressTip');
    if (old) old.remove();
    var tip = document.createElement('div');
    tip.id = 'samuelSaveProgressTip';
    tip.className = 'samuel-save-progress-tip';
    tip.textContent = message;
    document.body.appendChild(tip);
    var rect = target && target.getBoundingClientRect ? target.getBoundingClientRect() : { left: 18, bottom: 50, width: 1 };
    var width = tip.offsetWidth || 340;
    tip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
    tip.style.top = Math.max(8, rect.bottom + 10) + 'px';
    requestAnimationFrame(function () { tip.classList.add('is-visible'); });
    setTimeout(function () {
      tip.classList.remove('is-visible');
      setTimeout(function () { if (tip.parentNode) tip.remove(); }, 180);
    }, 2600);
  }
  function handleSaveAsFormatChange(event) {
    var select = event.target && (event.target.id === 'saveAsFormat' ? event.target : (event.target.closest && event.target.closest('#saveAsFormat')));
    if (!select || select.value !== 'docx') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (select.dataset.generatingDocx === '1') return;
    select.dataset.generatingDocx = '1';
    var status = document.getElementById('status');
    if (status) status.textContent = 'Generando Documento de Word...';
    downloadDocx()
      .then(function () {
        if (status) status.textContent = 'Documento de Word descargado: ' + 'Renombra tu archivo--- Actividad1_TuNombre_TuApellido.docx';
      })
      .catch(function (error) {
        console.error(error);
        alert('No se pudo generar el Documento de Word.');
      })
      .finally(function () {
        setTimeout(function () { select.dataset.generatingDocx = '0'; select.selectedIndex = -1; }, 0);
      });
  }
  async function downloadDocx() {
    var files = await buildDocxFiles();
    var blob = buildZip(files);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Renombra tu archivo--- Actividad1_TuNombre_TuApellido.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  async function buildDocxFiles() {
    var images = [];
    var bodyParts = [];
    var pages = Array.prototype.slice.call(document.querySelectorAll('.samuel-pdf-page'));
    if (!pages.length) pages = [document.getElementById('page')].filter(Boolean);
    await prepareDocxImages(pages, images);
    pages.forEach(function (page, index) {
      if (index > 0) bodyParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      var editor = page.querySelector('.editor') || page;
      domToWord(editor, bodyParts, images);
    });
    if (!bodyParts.length) bodyParts.push(paragraphXml('Documento en blanco'));
    var rels = images.map(function (img) {
      return '<Relationship Id="' + img.rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + img.name + '"/>';
    }).join('');
    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + bodyParts.join('') + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>';
    var files = [
      { name: '[Content_Types].xml', data: utf8(contentTypes) },
      { name: '_rels/.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
      { name: 'word/document.xml', data: utf8(documentXml) },
      { name: 'word/_rels/document.xml.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>') }
    ];
    images.forEach(function (img) { files.push({ name: 'word/media/' + img.name, data: img.bytes }); });
    return files;
  }
  function domToWord(root, out, images) {
    Array.prototype.slice.call(root.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var text = node.nodeValue.replace(/\s+/g, ' ').trim();
        if (text) out.push(paragraphXml(text));
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'table') { out.push(tableXml(node, images)); return; }
      if (tag === 'img') { out.push(imageXml(node, images)); return; }
      if (tag === 'br') { out.push(paragraphXml('')); return; }
      if (tag === 'ul' || tag === 'ol') {
        Array.prototype.slice.call(node.querySelectorAll(':scope > li')).forEach(function (li, i) {
          out.push(styledParagraphXml(li, { prefix: tag === 'ol' ? (i + 1) + '. ' : '• ', align: getTextAlign(li) }));
        });
        return;
      }
      if (hasDirectComplexChild(node)) {
        domToWord(node, out, images);
        return;
      }
      if (getCleanText(node) || node.querySelector('br')) {
        out.push(styledParagraphXml(node, blockOptions(node)));
      }
    });
  }
  function hasDirectComplexChild(node) {
    if (!node || !node.querySelector) return false;
    return !!node.querySelector('table, img, ul, ol');
  }
  function blockOptions(node) {
    var tag = node.tagName ? node.tagName.toLowerCase() : '';
    var opts = { align: getTextAlign(node) };
    if (tag === 'h1' || tag === 'h2') opts.bold = true;
    if (tag === 'h1') opts.size = 28;
    if (tag === 'h2') opts.size = 24;
    if (node.classList && node.classList.contains('section-two-budget-title')) opts.align = 'center';
    if (node.classList && node.classList.contains('section-three-title')) { opts.align = 'center'; opts.bold = true; }
    return opts;
  }
  function tableXml(table, images) {
    var rows = Array.prototype.slice.call(table.rows || []);
    return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="B9C1CA"/><w:left w:val="single" w:sz="4" w:space="0" w:color="B9C1CA"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="B9C1CA"/><w:right w:val="single" w:sz="4" w:space="0" w:color="B9C1CA"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="B9C1CA"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="B9C1CA"/></w:tblBorders></w:tblPr>' + rows.map(function (tr) {
      return '<w:tr>' + Array.prototype.slice.call(tr.cells || []).map(function (cell) {
        var cellContent = getCleanText(cell) || cell.querySelector('br') ? styledParagraphXml(cell, { align: getTextAlign(cell) }) : paragraphXml(' ');
        return '<w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr>' + cellContent + '</w:tc>';
      }).join('') + '</w:tr>';
    }).join('') + '</w:tbl>';
  }
  function paragraphXml(text, opts) {
    opts = opts || {};
    var pPr = paragraphProperties(opts);
    return '<w:p>' + pPr + runXml(text || '', opts) + '</w:p>';
  }
  function styledParagraphXml(element, opts) {
    opts = opts || {};
    var runs = [];
    if (opts.prefix) runs.push(runXml(opts.prefix, opts));
    collectRuns(element, mergeTextStyle({}, opts), runs);
    if (!runs.length) runs.push(runXml(' ', opts));
    return '<w:p>' + paragraphProperties(opts) + runs.join('') + '</w:p>';
  }
  function paragraphProperties(opts) {
    var align = normalizeAlign(opts && opts.align);
    return align ? '<w:pPr><w:jc w:val="' + align + '"/></w:pPr>' : '';
  }
  function collectRuns(node, inherited, runs) {
    if (!node) return;
    if (node.nodeType === 3) {
      var value = node.nodeValue || '';
      if (!value) return;
      value = value.replace(/\s+/g, ' ');
      if (value.trim()) runs.push(runXml(value, inherited));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'br') { runs.push('<w:r><w:br/></w:r>'); return; }
    if (tag === 'img') return;
    var style = mergeTextStyle(inherited, getNodeTextStyle(node));
    Array.prototype.slice.call(node.childNodes).forEach(function (child) { collectRuns(child, style, runs); });
  }
  function runXml(text, style) {
    style = style || {};
    var rPr = '';
    if (style.bold) rPr += '<w:b/>';
    if (style.italic) rPr += '<w:i/>';
    if (style.underline) rPr += '<w:u w:val="single"/>';
    if (style.strike) rPr += '<w:strike/>';
    if (style.color) rPr += '<w:color w:val="' + xmlEscape(style.color) + '"/>';
    if (style.highlight) rPr += '<w:highlight w:val="yellow"/>';
    if (style.size) rPr += '<w:sz w:val="' + style.size + '"/>';
    if (rPr) rPr = '<w:rPr>' + rPr + '</w:rPr>';
    return '<w:r>' + rPr + '<w:t xml:space="preserve">' + xmlEscape(text || '') + '</w:t></w:r>';
  }
  function getNodeTextStyle(node) {
    var tag = node.tagName ? node.tagName.toLowerCase() : '';
    var style = {};
    if (tag === 'b' || tag === 'strong') style.bold = true;
    if (tag === 'i' || tag === 'em') style.italic = true;
    if (tag === 'u') style.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') style.strike = true;
    if (tag === 'font' && node.getAttribute('color')) style.color = normalizeColor(node.getAttribute('color'));
    if (node.style) {
      if (node.style.fontWeight && isBoldWeight(node.style.fontWeight)) style.bold = true;
      if (node.style.fontStyle && node.style.fontStyle.toLowerCase().indexOf('italic') >= 0) style.italic = true;
      if (node.style.textDecoration && node.style.textDecoration.toLowerCase().indexOf('underline') >= 0) style.underline = true;
      if (node.style.textDecoration && node.style.textDecoration.toLowerCase().indexOf('line-through') >= 0) style.strike = true;
      if (node.style.color) style.color = normalizeColor(node.style.color);
      if (node.style.backgroundColor && isYellowish(node.style.backgroundColor)) style.highlight = true;
      if (node.style.fontSize) style.size = cssSizeToHalfPoints(node.style.fontSize);
    }
    try {
      var computed = window.getComputedStyle(node);
      if (computed) {
        if (isBoldWeight(computed.fontWeight)) style.bold = true;
        if (computed.fontStyle && computed.fontStyle.toLowerCase().indexOf('italic') >= 0) style.italic = true;
        var deco = (computed.textDecorationLine || computed.textDecoration || '').toLowerCase();
        if (deco.indexOf('underline') >= 0) style.underline = true;
        if (deco.indexOf('line-through') >= 0) style.strike = true;
        var computedColor = normalizeColor(computed.color);
        if (computedColor && computedColor !== '000000') style.color = computedColor;
        if (computed.backgroundColor && isYellowish(computed.backgroundColor)) style.highlight = true;
      }
    } catch (_) {}
    return style;
  }
  function mergeTextStyle(base, extra) {
    var merged = {};
    Object.keys(base || {}).forEach(function (key) { merged[key] = base[key]; });
    Object.keys(extra || {}).forEach(function (key) {
      if (extra[key] !== undefined && extra[key] !== null && extra[key] !== '') merged[key] = extra[key];
    });
    return merged;
  }
  function getTextAlign(node) {
    if (!node) return '';
    var align = '';
    if (node.style && node.style.textAlign) align = node.style.textAlign;
    try { align = align || window.getComputedStyle(node).textAlign; } catch (_) {}
    return normalizeAlign(align);
  }
  function normalizeAlign(value) {
    value = String(value || '').toLowerCase();
    if (value === 'center' || value === 'right' || value === 'both') return value;
    if (value === 'justify') return 'both';
    return '';
  }
  function isBoldWeight(value) {
    value = String(value || '').toLowerCase();
    if (value === 'bold' || value === 'bolder') return true;
    var numeric = parseInt(value, 10);
    return !isNaN(numeric) && numeric >= 600;
  }
  function cssSizeToHalfPoints(value) {
    var match = String(value || '').match(/([0-9.]+)/);
    if (!match) return null;
    var px = parseFloat(match[1]);
    if (!px) return null;
    return Math.max(8, Math.round(px * 1.5));
  }
  function isYellowish(value) {
    var hex = normalizeColor(value);
    return hex === 'FFFF00' || hex === 'FFF000' || hex === 'FFC000';
  }
  function normalizeColor(value) {
    value = String(value || '').trim();
    if (!value || value === 'transparent' || value === 'inherit') return '';
    if (value.charAt(0) === '#') {
      var h = value.slice(1);
      if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
      return h.slice(0, 6).toUpperCase();
    }
    var rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgb) {
      return [rgb[1], rgb[2], rgb[3]].map(function (part) {
        return ('0' + Math.max(0, Math.min(255, parseInt(part, 10))).toString(16)).slice(-2);
      }).join('').toUpperCase();
    }
    var named = { red: 'FF0000', blue: '0000FF', black: '000000', white: 'FFFFFF', green: '008000', yellow: 'FFFF00', orange: 'FFA500', purple: '800080' };
    return named[value.toLowerCase()] || '';
  }
  async function prepareDocxImages(pages, images) {
    var nodes = [];
    pages.forEach(function (page) {
      nodes = nodes.concat(Array.prototype.slice.call(page.querySelectorAll('img')));
    });
    for (var i = 0; i < nodes.length; i++) {
      var img = nodes[i];
      try {
        var extracted = await extractImageForDocx(img);
        if (!extracted || !extracted.bytes || !extracted.bytes.length) continue;
        var ext = extracted.ext || 'png';
        var rId = 'rId' + (images.length + 2);
        var name = 'image' + (images.length + 1) + '.' + ext;
        var size = imageSizeForDocx(img);
        var item = { rId: rId, name: name, bytes: extracted.bytes, cx: size.cx, cy: size.cy };
        images.push(item);
        img.__samuelDocxImage = item;
      } catch (error) {
        console.warn('No se pudo preparar una imagen para Word.', error);
      }
    }
  }
  async function extractImageForDocx(img) {
    var src = img.getAttribute('src') || '';
    if (src.indexOf('data:image/') === 0) {
      var parsed = dataUrlToBytes(src);
      if (parsed) return normalizeImageBytes(parsed.mime, parsed.bytes, img);
    }
    if (src) {
      try {
        var response = await fetch(src);
        if (response && response.ok) {
          var blob = await response.blob();
          var buffer = await blob.arrayBuffer();
          return normalizeImageBytes(blob.type || 'image/png', new Uint8Array(buffer), img);
        }
      } catch (_) {}
    }
    return imageElementToPngBytes(img);
  }
  async function normalizeImageBytes(mime, bytes, img) {
    mime = String(mime || '').toLowerCase();
    if (mime.indexOf('png') >= 0) return { ext: 'png', bytes: bytes };
    if (mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0) return { ext: 'jpg', bytes: bytes };
    return imageElementToPngBytes(img);
  }
  async function imageElementToPngBytes(img) {
    await waitForImageReady(img);
    var width = img.naturalWidth || Math.max(1, Math.round(img.getBoundingClientRect().width || 640));
    var height = img.naturalHeight || Math.max(1, Math.round(img.getBoundingClientRect().height || 480));
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d', { alpha: true });
    ctx.drawImage(img, 0, 0, width, height);
    var parsed = dataUrlToBytes(canvas.toDataURL('image/png'));
    return parsed ? { ext: 'png', bytes: parsed.bytes } : null;
  }
  function waitForImageReady(img) {
    return new Promise(function (resolve) {
      if (!img || (img.complete && img.naturalWidth)) return resolve();
      var done = function () { resolve(); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 1200);
    });
  }
  function imageSizeForDocx(img) {
    var rect = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: 0, height: 0 };
    var widthPx = rect.width || parseFloat(img.style.width) || img.naturalWidth || 560;
    var heightPx = rect.height || parseFloat(img.style.height) || img.naturalHeight || 360;
    if (!heightPx && img.naturalWidth && img.naturalHeight && widthPx) heightPx = widthPx * (img.naturalHeight / img.naturalWidth);
    var maxWidthPx = 624;
    if (widthPx > maxWidthPx) {
      var ratio = maxWidthPx / widthPx;
      widthPx = maxWidthPx;
      heightPx = heightPx * ratio;
    }
    return { cx: Math.max(1, Math.round(widthPx * 9525)), cy: Math.max(1, Math.round(heightPx * 9525)) };
  }
  function imageXml(img) {
    var item = img.__samuelDocxImage;
    if (!item) return paragraphXml('[Imagen insertada]');
    var cx = item.cx || 5486400;
    var cy = item.cy || 3657600;
    return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + item.rId.replace(/\D/g, '') + '" name="Imagen ' + xmlEscape(item.name) + '"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="' + xmlEscape(item.name) + '"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + item.rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }
  function getCleanText(node) { return (node.innerText || node.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
  function dataUrlToBytes(url) {
    var match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(url);
    if (!match) return null;
    var raw = atob(match[2]);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 255;
    return { mime: match[1], bytes: bytes };
  }
  function buildZip(files) {
    var localParts = [], centralParts = [], offset = 0;
    files.forEach(function (file) {
      var name = utf8(file.name), data = file.data instanceof Uint8Array ? file.data : utf8(String(file.data || ''));
      var crc = crc32(data), size = data.length;
      var local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(name.length), u16(0), name, data]);
      var central = concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
      localParts.push(local); centralParts.push(central); offset += local.length;
    });
    var central = concat(centralParts);
    var end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)]);
    return new Blob([concat(localParts), central, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  function crc32(data) {
    var table = crc32.table || (crc32.table = makeCrcTable());
    var crc = -1;
    for (var i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 255];
    return (crc ^ -1) >>> 0;
  }
  function makeCrcTable() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    return table;
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function u16(v) { var a = new Uint8Array(2); a[0] = v & 255; a[1] = (v >>> 8) & 255; return a; }
  function u32(v) { var a = new Uint8Array(4); a[0] = v & 255; a[1] = (v >>> 8) & 255; a[2] = (v >>> 16) & 255; a[3] = (v >>> 24) & 255; return a; }
  function concat(parts) { var len = parts.reduce(function (s, p) { return s + p.length; }, 0); var out = new Uint8Array(len); var pos = 0; parts.forEach(function (p) { out.set(p, pos); pos += p.length; }); return out; }
  function xmlEscape(value) { return String(value).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  function getDocumentNameRaw() { var input = document.getElementById('documentTitle'); return input && input.value ? input.value : 'Documento1 - Word'; }
  function safeFileName(name) { return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Documento1 - Word'; }
  function sectionFromTitle(title) { var m = String(title || '').match(/Secci[oó]n\s+(\d+)/i); return m ? parseInt(m[1], 10) : 1; }
  function getCurrentSectionNumber() {
    var focused = document.activeElement;
    if (focused && focused.closest) { var page = focused.closest('.samuel-pdf-page'); if (page) return parseInt(page.getAttribute('data-section') || '1', 10) || 1; }
    return sectionFromTitle(getDocumentNameRaw());
  }
})();


;/* ===== samuel-final-blue-tips-and-steps-js ===== */

(function () {
  'use strict';
  var currentSection = 1;
  var panelOpen = false;
  var wrap, button, panel, titleNode, bodyNode, closeButton;
  var hasSavedStepsPlacement = false;
  var sectionSteps = {
    1: { title: 'Pasos de la Sección 1', items: [
      'Haz clic en la hoja en blanco para comenzar la redacción.',
      'Redacta un párrafo de 3 a 4 líneas donde expliques por qué elegiste esta carrera.',
      'Cuando termines el párrafo, presiona Enter para saltar de línea.',
      'Escribe un título apropiado relacionado con el contenido de tu párrafo.',
      'Selecciona todo el título y aplica negritas desde la cinta de opciones.',
      'Con el título seleccionado, abre el color de fuente y aplica el color institucional azul.',
      'Regresa a tu párrafo, selecciona una palabra o frase importante y aplica cursiva para destacarla.',
      'Presiona Enter después del párrafo, activa la lista con viñetas y escribe dos metas que quieras lograr durante tu carrera.',
      'Cuando tengas tus dos metas, da clic en el botón Terminar para pasar a la Sección 2.'
    ]},
    2: { title: 'Pasos de la Sección 2', items: [
      'Observa la tabla de presupuesto semanal y ubica los días de la semana y los horarios.',
      'Haz clic dentro de las celdas editables de la tabla.',
      'Escribe Trabajo, Familia o Estudio según el tiempo que destines a cada actividad.',
      'Si en una misma celda necesitas colocar más de una actividad, presiona Enter para separar cada frase.',
      'Si un horario no aplica para tu semana, deja la celda en blanco.',
      'Revisa que tu distribución semanal esté completa y clara.',
      'Cuando termines la tabla, da clic en el botón Terminar para pasar a la Sección 3.'
    ]},
    3: { title: 'Pasos de la Sección 3', items: [
      'Haz clic en la zona en blanco de la Sección 3 para iniciar la inserción de tu captura.',
      'Da clic en la pestaña Insertar de la cinta superior.',
      'Selecciona la opción Imágenes para buscar tu captura de pantalla en el equipo.',
      'Elige la captura de tu participación en el Foro de Bienvenida y espera a que aparezca dentro de la hoja.',
      'Verifica que la imagen se vea correctamente debajo del título de la sección.',
      'Cuando ya hayas insertado la imagen, da clic en el botón Terminar.',
      'En el flujo final, entra a Archivo, después a Guardar como y elige Documento de Word o PDF para descargar tu trabajo.',
      'Después de descargar tu archivo, da clic en el botón Terminar para ver la indicación final de entrega.'
    ]}
  };
  function ready(callback) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback); else callback(); }
  ready(function () {
    createStepsInterface();
    applySaveAsOptionVisuals();
    updateSectionAndVisibility();
    document.addEventListener('click', function () { setTimeout(function(){ applySaveAsOptionVisuals(); updateSectionAndVisibility(); }, 60); }, true);
    document.addEventListener('keyup', function () { setTimeout(updateSectionAndVisibility, 60); }, true);
    window.addEventListener('scroll', updateSectionAndVisibility, true);
    window.addEventListener('resize', function () { updateSectionAndVisibility(); if (!hasSavedStepsPlacement) placeStepsButtonAtLeftGrayZone(); else keepStepsButtonInsideViewport(); if (hasSavedStepsPlacement) saveStepsButtonPlacement(); });
    setInterval(function(){ applySaveAsOptionVisuals(); updateSectionAndVisibility(); }, 700);
  });
  function applySaveAsOptionVisuals() {
    var select = document.getElementById('saveAsFormat');
    if (!select || !select.options) return;
    Array.prototype.slice.call(select.options).forEach(function (option) {
      if (option.value === 'docx') {
        option.disabled = false; option.style.color = '#2A6AFF'; option.style.fontWeight = '700'; option.style.opacity = '1';
      } else if (option.value === 'pdf') {
        option.disabled = false; option.style.color = '#FF7D01'; option.style.fontWeight = '700'; option.style.opacity = '1';
      } else {
        option.disabled = true; option.style.color = 'rgba(255,255,255,.30)'; option.style.fontWeight = '400'; option.style.opacity = '.32';
      }
    });
  }
  function createStepsInterface() {
    if (document.getElementById('samuelShowStepsAgainWrap')) return;
    wrap = document.createElement('div');
    wrap.id = 'samuelShowStepsAgainWrap';
    wrap.innerHTML = '<button id="samuelShowStepsAgainButton" type="button">Mostrar pasos detallados</button><span class="samuel-drag-help">Arrastra para mover</span><div id="samuelShowStepsAgainPanel" role="dialog" aria-live="polite" aria-label="Pasos de la sección actual"><div class="samuel-steps-header"><h3 class="samuel-steps-title"></h3><button class="samuel-steps-close" type="button" aria-label="Cerrar pasos">×</button></div><div class="samuel-steps-body"></div></div>';
    document.body.appendChild(wrap);
    button = document.getElementById('samuelShowStepsAgainButton');
    panel = document.getElementById('samuelShowStepsAgainPanel');
    titleNode = panel.querySelector('.samuel-steps-title');
    bodyNode = panel.querySelector('.samuel-steps-body');
    closeButton = panel.querySelector('.samuel-steps-close');
    button.addEventListener('click', function (event) {
      event.preventDefault(); event.stopPropagation();
      currentSection = detectCurrentSection();
      renderSteps(currentSection);
      panelOpen = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', panelOpen);
    });
    closeButton.addEventListener('click', function (event) {
      event.preventDefault(); event.stopPropagation();
      panelOpen = false; panel.classList.remove('is-open');
    });
    installDraggableStepsButton();
    restoreStepsButtonPlacement();
  }
  function getStepsPlacementKey() {
    var matricula = window.__samuelCurrentMatricula || 'global';
    return 'samuel-steps-button-placement-v3::' + encodeURIComponent(matricula);
  }
  function saveStepsButtonPlacement() {
    if (!wrap) return;
    try {
      localStorage.setItem(getStepsPlacementKey(), JSON.stringify({
        left: wrap.style.left,
        top: wrap.style.top,
        width: wrap.style.width,
        height: wrap.style.height
      }));
    } catch (_) {}
  }
  function restoreStepsButtonPlacement() {
    if (!wrap) return;
    wrap.classList.add('is-draggable');
    hasSavedStepsPlacement = false;
    try {
      var raw = localStorage.getItem(getStepsPlacementKey()) || localStorage.getItem('samuel-steps-button-placement-v3::global');
      if (!raw) {
        placeStepsButtonAtLeftGrayZone();
        return;
      }
      var data = JSON.parse(raw);
      if (data.left) wrap.style.left = data.left;
      if (data.top) wrap.style.top = data.top;
      if (data.width) wrap.style.width = data.width;
      if (data.height) wrap.style.height = data.height;
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      hasSavedStepsPlacement = true;
      keepStepsButtonInsideViewport();
    } catch (_) {
      placeStepsButtonAtLeftGrayZone();
    }
  }
  function placeStepsButtonAtLeftGrayZone() {
    if (!wrap) return;
    var page = document.getElementById(currentSection === 1 ? 'page' : 'page' + currentSection) || document.querySelector('.samuel-pdf-page') || document.querySelector('.page');
    var rect = page && page.getBoundingClientRect ? page.getBoundingClientRect() : null;
    var width = Math.min(wrap.offsetWidth || 300, Math.max(220, window.innerWidth - 24));
    var left;
    var top;
    if (rect && rect.width) {
      left = rect.left - width - 24;
      if (left < 12) left = Math.max(12, rect.left + 12);
      top = rect.top + 118;
    } else {
      left = 24;
      top = 260;
    }
    top = Math.max(92, Math.min(top, window.innerHeight - Math.min(wrap.offsetHeight || 56, window.innerHeight - 16) - 16));
    wrap.style.width = width + 'px';
    wrap.style.left = Math.round(left) + 'px';
    wrap.style.top = Math.round(top) + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
    keepStepsButtonInsideViewport();
  }
  function keepStepsButtonInsideViewport() {
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var left = Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(rect.width, window.innerWidth - 16) - 8));
    var top = Math.max(8, Math.min(rect.top, window.innerHeight - Math.min(rect.height, window.innerHeight - 16) - 8));
    wrap.style.left = left + 'px';
    wrap.style.top = top + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  }
  function installDraggableStepsButton() {
    if (!wrap || !button || wrap.__samuelDragInstalled) return;
    wrap.__samuelDragInstalled = true;
    wrap.classList.add('is-draggable');
    var dragging = false;
    var moved = false;
    var startX = 0, startY = 0, startLeft = 0, startTop = 0;
    button.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      var rect = wrap.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      wrap.classList.add('is-dragging');
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
    });
    button.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      var width = wrap.offsetWidth || 260;
      var height = wrap.offsetHeight || 48;
      var left = Math.max(8, Math.min(startLeft + dx, window.innerWidth - width - 8));
      var top = Math.max(8, Math.min(startTop + dy, window.innerHeight - height - 8));
      wrap.style.left = left + 'px';
      wrap.style.top = top + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
      if (moved) event.preventDefault();
    });
    function finishDrag(event) {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove('is-dragging');
      keepStepsButtonInsideViewport();
      hasSavedStepsPlacement = true;
      saveStepsButtonPlacement();
      if (moved) {
        button.__samuelIgnoreNextClick = true;
        setTimeout(function () { button.__samuelIgnoreNextClick = false; }, 80);
        if (event) event.preventDefault();
      }
    }
    button.addEventListener('pointerup', finishDrag);
    button.addEventListener('pointercancel', finishDrag);
    button.addEventListener('click', function (event) {
      if (button.__samuelIgnoreNextClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    var resizeObserver = new ResizeObserver(function () {
      keepStepsButtonInsideViewport();
      if (wrap.classList.contains('is-visible')) {
        hasSavedStepsPlacement = true;
        saveStepsButtonPlacement();
      }
    });
    try { resizeObserver.observe(wrap); } catch (_) {}
  }
  function renderSteps(section) {
    var data = sectionSteps[section] || sectionSteps[1];
    titleNode.textContent = data.title;
    bodyNode.innerHTML = '<ol>' + data.items.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol>';
  }
  function updateSectionAndVisibility() {
    if (!wrap) return;
    var shouldShow = shouldShowStepsButton();
    wrap.classList.toggle('is-visible', shouldShow);
    if (shouldShow) {
      restoreStepsButtonPlacement();
      if (!hasSavedStepsPlacement) setTimeout(placeStepsButtonAtLeftGrayZone, 60);
    }
    if (!shouldShow) { panelOpen = false; if (panel) panel.classList.remove('is-open'); return; }
    var detected = detectCurrentSection();
    if (detected !== currentSection) {
      currentSection = detected;
      panelOpen = false;
      panel.classList.remove('is-open');
      renderSteps(currentSection);
      if (!hasSavedStepsPlacement) placeStepsButtonAtLeftGrayZone();
    }
  }
  function shouldShowStepsButton() {
    if (typeof window.__samuelGetTutorialProgress === 'function') {
      try {
        var progress = window.__samuelGetTutorialProgress();
        if (progress && (progress.finalFlowReady || /^final-/.test(String(progress.state || '')))) return false;
      } catch (_) {}
    }
    var backstage = document.getElementById('backstage');
    if (backstage && !backstage.hidden) return false;
    if (document.querySelector('#samuelStartIntroOverlay.is-visible, #samuelTutorialCompleteOverlay.is-visible, #samuelTutorialSection2Overlay.is-visible, #samuelTutorialSection3Overlay.is-visible, #samuelFinalDeliveryOverlay.is-visible')) return false;
    if (document.querySelector('.modal-dialog[open]')) return false;
    return !!document.querySelector('.document-workspace');
  }
  function detectCurrentSection() {
    if (typeof window.__samuelGetTutorialProgress === 'function') {
      try { var progress = window.__samuelGetTutorialProgress(); if (progress && progress.activeSection) return clampSection(parseInt(progress.activeSection, 10)); } catch (_) {}
    }
    var title = document.getElementById('documentTitle');
    var titleMatch = title && title.value ? title.value.match(/Secci[oó]n\s+(\d+)/i) : null;
    if (titleMatch) return clampSection(parseInt(titleMatch[1], 10));
    var pageStatus = document.getElementById('pageStatus');
    var statusMatch = pageStatus && pageStatus.textContent ? pageStatus.textContent.match(/Página\s+(\d+)\s+de/i) : null;
    if (statusMatch) return clampSection(parseInt(statusMatch[1], 10));
    var pages = Array.prototype.slice.call(document.querySelectorAll('.samuel-pdf-page'));
    if (!pages.length) return 1;
    var targetY = window.innerHeight * 0.42;
    var best = { section: 1, distance: Infinity };
    pages.forEach(function (page) {
      var rect = page.getBoundingClientRect();
      var middle = rect.top + rect.height / 2;
      var distance = Math.abs(middle - targetY);
      if (distance < best.distance) best = { section: parseInt(page.getAttribute('data-section') || '1', 10) || 1, distance: distance };
    });
    return clampSection(best.section);
  }
  function clampSection(value) { if (value < 1) return 1; if (value > 3) return 3; return value; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
})();


;/* ===== samuel-mobile-responsive-js ===== */

(function () {
  'use strict';
  if (window.__samuelMobileResponsiveInstalled) return;
  window.__samuelMobileResponsiveInstalled = true;

  var mobileQuery = window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)');

  function updateMobileLayout() {
    var isMobile = mobileQuery.matches;
    document.documentElement.classList.toggle('samuel-mobile-layout', isMobile);
    if (!isMobile) {
      document.documentElement.style.setProperty('--mobile-page-scale', '1');
      return;
    }
    var available = Math.max(280, window.innerWidth - 16);
    var scale = Math.min(1, available / 816);
    document.documentElement.style.setProperty('--mobile-page-scale', scale.toFixed(4));

    document.querySelectorAll('.tab-row .tab.active').forEach(function (tab) {
      try { tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (_) {}
    });
  }

  function keepActiveControlsVisible(event) {
    if (!mobileQuery.matches) return;
    var tab = event.target && event.target.closest ? event.target.closest('.tab-row .tab') : null;
    if (tab) setTimeout(function () {
      try { tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (_) {}
    }, 40);
  }

  function focusEditable(event) {
    if (!mobileQuery.matches) return;
    var editable = event.target && event.target.closest ? event.target.closest('[contenteditable="true"]') : null;
    if (!editable) return;
    setTimeout(function () {
      try { editable.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}
    }, 280);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateMobileLayout);
  else updateMobileLayout();
  window.addEventListener('resize', updateMobileLayout, { passive: true });
  window.addEventListener('orientationchange', function () { setTimeout(updateMobileLayout, 180); }, { passive: true });
  document.addEventListener('click', keepActiveControlsVisible, true);
  document.addEventListener('focusin', focusEditable, true);
  if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', updateMobileLayout);
  else if (mobileQuery.addListener) mobileQuery.addListener(updateMobileLayout);
})();


;/* ===== samuel-mobile-compact-v2-js ===== */

(function(){
  'use strict';
  if(window.__samuelCompactV2)return; window.__samuelCompactV2=true;
  function setViewportHeight(){
    var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
    document.documentElement.style.setProperty('--samuel-vh',(h*.01)+'px');
  }
  function prepareStepsButton(){
    var b=document.getElementById('samuelShowStepsAgainButton');
    if(!b)return;
    b.setAttribute('aria-label','Mostrar pasos detallados');
    b.setAttribute('title','Mostrar pasos detallados');
  }
  function closeFloatingPanelOnEscape(e){
    if(e.key!=='Escape')return;
    var p=document.getElementById('samuelShowStepsAgainPanel');
    if(p&&p.classList.contains('is-open')){
      var c=p.querySelector('.samuel-steps-close'); if(c)c.click();
    }
  }
  setViewportHeight(); prepareStepsButton();
  window.addEventListener('resize',setViewportHeight,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(setViewportHeight,150)},{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',setViewportHeight,{passive:true});
  document.addEventListener('keydown',closeFloatingPanelOnEscape);
  new MutationObserver(prepareStepsButton).observe(document.documentElement,{childList:true,subtree:true});
})();


;/* ===== samuel-v3-stable-js ===== */

(function(){
'use strict';
if(window.__samuelV3Stable)return;window.__samuelV3Stable=true;
var initialized=false,wrap,drag=null,moved=false;
function mobile(){return matchMedia('(max-width:1024px), (hover:none) and (pointer:coarse)').matches}
function buildToolbar(){
 if(!mobile())return;
 var ribbon=document.getElementById('tab-inicio');if(!ribbon)return;
 ribbon.querySelectorAll('[data-cmd="strikeThrough"],[data-action="subscript"],[data-action="superscript"],[data-cmd="removeFormat"]').forEach(function(el){el.remove()});
 var bar=ribbon.querySelector('.v3-mobile-toolbar');
 if(!bar){bar=document.createElement('div');bar.className='group v3-mobile-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Formato esencial');ribbon.insertBefore(bar,ribbon.firstChild)}
 var bold=ribbon.querySelector('[data-cmd="bold"]'),italic=ribbon.querySelector('[data-cmd="italic"]'),underline=ribbon.querySelector('[data-cmd="underline"]');
 var color=ribbon.querySelector('[data-action="toggleTextPalette"]'),colorWrap=color&&color.closest('.palette-wrapper');
 var highlight=ribbon.querySelector('[data-action="toggleHighlightPalette"]'),highlightWrap=highlight&&highlight.closest('.palette-wrapper');
 var list=ribbon.querySelector('[data-cmd="insertUnorderedList"]');
 if(bold)bold.innerHTML='<b>N</b>';if(italic)italic.innerHTML='<i>K</i>';if(underline)underline.innerHTML='<u>S</u>';
 if(list){list.hidden=false;list.removeAttribute('aria-hidden');list.textContent='Lista';list.title='Lista con viñetas';list.setAttribute('aria-label','Lista con viñetas')}
 [bold,italic,underline,colorWrap,highlightWrap,list].forEach(function(el){if(el&&el.parentElement!==bar)bar.appendChild(el)});
}
function bounds(x,y){var r=wrap.getBoundingClientRect(),p=6;return{x:Math.max(p,Math.min(x,innerWidth-r.width-p)),y:Math.max(p,Math.min(y,innerHeight-r.height-p))}}
function place(x,y,save){var p=bounds(x,y);wrap.style.setProperty('--v3-x',p.x+'px');wrap.style.setProperty('--v3-y',p.y+'px');wrap.style.setProperty('--v3-right','auto');wrap.style.setProperty('--v3-bottom','auto');if(save)try{localStorage.setItem('v3StepsPos',JSON.stringify(p))}catch(e){}}
function restore(){if(!wrap)return;var p;try{p=JSON.parse(localStorage.getItem('v3StepsPos')||'null')}catch(e){}if(p&&isFinite(p.x)&&isFinite(p.y))place(p.x,p.y,false)}
function down(e){var panel=document.getElementById('samuelShowStepsAgainPanel');if(panel&&panel.classList.contains('is-open'))return;var r=wrap.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,sx:e.clientX,sy:e.clientY};moved=false;e.currentTarget.setPointerCapture&&e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault()}
function move(e){if(!drag||e.pointerId!==drag.id)return;if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>5)moved=true;place(e.clientX-drag.dx,e.clientY-drag.dy,false);e.preventDefault()}
function up(e){if(!drag||e.pointerId!==drag.id)return;place(e.clientX-drag.dx,e.clientY-drag.dy,true);drag=null;e.preventDefault();if(!moved)setTimeout(function(){e.currentTarget.click()},0)}
function initDrag(){wrap=document.getElementById('samuelShowStepsAgainWrap');var b=document.getElementById('samuelShowStepsAgainButton');if(!wrap||!b)return;if(b.dataset.v3Drag)return;b.dataset.v3Drag='1';b.addEventListener('pointerdown',down,true);b.addEventListener('pointermove',move,true);b.addEventListener('pointerup',up,true);b.addEventListener('pointercancel',up,true);restore()}
function targetForTip(tip){var h=document.querySelector('.samuel-tutorial-highlight');if(h&&h.getBoundingClientRect().width)return h;var t=(tip.textContent||'').toLowerCase(),s='';if(/negrita/.test(t))s='[data-cmd="bold"]';else if(/cursiva/.test(t))s='[data-cmd="italic"]';else if(/subray/.test(t))s='[data-cmd="underline"]';else if(/viñeta|lista/.test(t))s='[data-cmd="insertUnorderedList"]';else if(/color/.test(t))s='[data-action="toggleTextPalette"]';return s?document.querySelector(s):null}
function placeTips(){document.querySelectorAll('.samuel-tutorial-tip:not(.tip-inside-cell):not(.section2-table-tip)').forEach(function(tip){var target=targetForTip(tip);if(!target)return;var tr=target.getBoundingClientRect(),w=tip.offsetWidth||210,h=tip.offsetHeight||38,p=6,g=8;var left=Math.max(p,Math.min(tr.left+tr.width/2-w/2,innerWidth-w-p));var top=tr.top-h-g;if(top<p)top=tr.bottom+g;tip.style.setProperty('left',left+'px','important');tip.style.setProperty('top',top+'px','important');tip.style.setProperty('right','auto','important');tip.style.setProperty('bottom','auto','important')})}
function refresh(){buildToolbar();initDrag();placeTips()}
function init(){if(initialized)return;initialized=true;refresh();document.addEventListener('click',function(e){if(e.target.closest('.tab[data-tab="inicio"]'))setTimeout(refresh,0)},true);new MutationObserver(function(m){var needed=m.some(function(x){return x.type==='childList'});if(needed)requestAnimationFrame(refresh)}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
addEventListener('resize',refresh,{passive:true});addEventListener('orientationchange',function(){setTimeout(refresh,200)},{passive:true});
})();


;/* ===== samuel-v3-portrait-fine-tune-js ===== */

(function(){
  'use strict';
  if(window.__samuelV3PortraitFineTune)return;
  window.__samuelV3PortraitFineTune=true;

  function portraitMobile(){
    return matchMedia('(orientation:portrait) and (max-width:600px)').matches;
  }

  function improveTouchTargets(){
    if(!portraitMobile())return;
    var toolbar=document.querySelector('#tab-inicio .v3-mobile-toolbar');
    if(!toolbar)return;
    toolbar.querySelectorAll('button').forEach(function(button){
      button.style.setProperty('pointer-events','auto','important');
      button.style.setProperty('touch-action','manipulation','important');
      button.removeAttribute('disabled');
    });
    var color=toolbar.querySelector('[data-action="toggleTextPalette"]');
    if(color){
      color.setAttribute('aria-label','Color del texto');
      color.setAttribute('title','Color del texto');
    }
  }

  function refresh(){requestAnimationFrame(improveTouchTargets);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();
  addEventListener('resize',refresh,{passive:true});
  addEventListener('orientationchange',function(){setTimeout(refresh,180)},{passive:true});
  document.addEventListener('click',function(event){
    if(event.target.closest('.tab[data-tab="inicio"]'))setTimeout(improveTouchTargets,0);
  },true);
})();


;/* ===== samuel-v3-toolbar-final-touch-js ===== */

(function(){
  'use strict';
  if(window.__samuelV3ToolbarFinalTouch)return;
  window.__samuelV3ToolbarFinalTouch=true;

  function mobile(){
    return matchMedia('(max-width:1024px), (hover:none) and (pointer:coarse)').matches;
  }

  function configure(){
    if(!mobile())return;
    var ribbon=document.getElementById('tab-inicio');
    var toolbar=ribbon&&ribbon.querySelector('.v3-mobile-toolbar');
    if(!ribbon||!toolbar)return;

    /* Eliminacion real del icono adjunto y de su paleta. */
    var highlight=ribbon.querySelector('[data-action="toggleHighlightPalette"]');
    if(highlight){
      var highlightWrap=highlight.closest('.palette-wrapper');
      if(highlightWrap)highlightWrap.remove();
      else highlight.remove();
    }
    var highlightPalette=document.getElementById('highlightPalette');
    if(highlightPalette)highlightPalette.remove();

    /* Garantizar que cada contenedor completo sea interactivo. */
    toolbar.querySelectorAll('button').forEach(function(button){
      button.disabled=false;
      button.removeAttribute('disabled');
      button.style.setProperty('pointer-events','auto','important');
      button.style.setProperty('touch-action','manipulation','important');
      button.setAttribute('tabindex','0');
    });

    var textColor=toolbar.querySelector('[data-action="toggleTextPalette"]');
    var textWrap=textColor&&textColor.closest('.palette-wrapper');
    if(textWrap)textWrap.classList.add('v3-text-color-wrapper');
    if(textColor){
      textColor.setAttribute('title','Color del texto');
      textColor.setAttribute('aria-label','Color del texto');
    }

    positionPalette();
  }

  function positionPalette(){
    if(!mobile())return;
    var ribbon=document.getElementById('tab-inicio');
    if(!ribbon)return;
    var rect=ribbon.getBoundingClientRect();
    var top=Math.max(6,Math.min(rect.bottom+5,innerHeight-120));
    document.documentElement.style.setProperty('--v3-palette-top',top+'px');
  }

  /* Si se toca el relleno del contenedor de color, abrir la misma paleta. */
  document.addEventListener('pointerup',function(event){
    if(!mobile())return;
    var wrap=event.target.closest&&event.target.closest('#tab-inicio .v3-text-color-wrapper');
    if(!wrap||event.target.closest('button'))return;
    var button=wrap.querySelector('[data-action="toggleTextPalette"]');
    if(button)button.click();
  },true);

  function refresh(){requestAnimationFrame(configure);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();
  addEventListener('resize',refresh,{passive:true});
  addEventListener('orientationchange',function(){setTimeout(refresh,200)},{passive:true});
  document.addEventListener('click',function(event){
    if(event.target.closest('.tab[data-tab="inicio"]'))setTimeout(configure,0);
  },true);
})();


;/* ===== samuel-v3-landscape-flow-clean-js ===== */

(function(){
'use strict';
if(window.__samuelV3LandscapeFlowClean)return;window.__samuelV3LandscapeFlowClean=true;
var box=null,lastSection=0,phase2Touched=false,phase3Touched=false,pending=false;
function landscape(){return matchMedia('(orientation:landscape) and (max-height:600px)').matches}
function section(){
 var t=document.getElementById('documentTitle'),v=t?String(t.value||t.textContent||''):'';var m=v.match(/Secci[oó]n\s*([123])/i);if(m)return +m[1];
 var p=document.getElementById('pageStatus'),x=p?String(p.textContent||''):'';m=x.match(/P[aá]gina\s*([123])\s*de\s*3/i);return m?+m[1]:0;
}
function removeBox(){var b=document.getElementById('samuelV3LandscapeInstruction');if(b)b.remove();box=null}
function showBox(text){if(!box||!box.isConnected){box=document.createElement('div');box.id='samuelV3LandscapeInstruction';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.appendChild(box)}box.textContent=text}
function cleanTips(s){
 document.querySelectorAll('.samuel-tutorial-tip').forEach(function(t){var x=(t.textContent||'').toLowerCase();
  t.classList.toggle('v3-hide-finish-tip',s===2&&/cu[aá]ndo termines da clic aqu[ií]/.test(x));
  if(phase2Touched&&s===2&&/escribe:\s*trabajo/.test(x))t.classList.add('v3-hide-cell-tip');
 });
}
function update(){pending=false;var s=section();if(s!==lastSection){if(s===2)phase2Touched=false;if(s===3)phase3Touched=false;lastSection=s}
 if(!landscape()){removeBox();return}
 cleanTips(s);
 var finish=document.getElementById('samuelTutorialFinishButton');if(finish)finish.classList.toggle('v3-phase2-finish',s===2&&!finish.hidden);
 if(s===2&&!phase2Touched)showBox('Haz clic dentro de cada celda y completa tus horarios, coloca la frase: Trabajo, Familia o Estudio, según el tiempo que le destines a lo largo de tu semana. Si no aplica, deja la celda en blanco.');
 else if(s===3&&!phase3Touched)showBox('Aquí, insertarás la captura de pantalla que tomaste de tu participación en el Foro de Bienvenida, sigue los siguientes pasos para hacerlo correctamente (da clic en la zona en blanco para comenzar)');
 else removeBox();
}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(update)}
document.addEventListener('pointerdown',function(e){if(!landscape())return;var s=section();
 if(s===2&&e.target.closest&&e.target.closest('#editor2 .weekly-budget-table td:not(.budget-time-cell)')){phase2Touched=true;removeBox();document.querySelectorAll('.samuel-tutorial-tip').forEach(function(t){if(/escribe:\s*trabajo/i.test(t.textContent||''))t.classList.add('v3-hide-cell-tip')})}
 if(s===3&&e.target.closest&&e.target.closest('#page3')){phase3Touched=true;removeBox()}
},true);
document.addEventListener('input',function(e){if(section()===2&&e.target.closest&&e.target.closest('#editor2 .weekly-budget-table td:not(.budget-time-cell)')){phase2Touched=true;removeBox()}},true);
document.addEventListener('click',function(){setTimeout(schedule,40)},true);
addEventListener('resize',schedule,{passive:true});addEventListener('orientationchange',function(){setTimeout(schedule,180)},{passive:true});
function init(){schedule();var title=document.getElementById('documentTitle'),status=document.getElementById('pageStatus');var o=new MutationObserver(schedule),opts={attributes:true,childList:true,characterData:true,subtree:true};if(title)o.observe(title,opts);if(status)o.observe(status,opts)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


;/* ===== samuel-v3-single-landscape-instruction-js ===== */

(function(){
  'use strict';
  if(window.__samuelV3SingleLandscapeInstruction)return;
  window.__samuelV3SingleLandscapeInstruction=true;

  var pending=false;
  var dismissed={2:false,3:false};
  var previousSection=0;

  function landscape(){
    return window.matchMedia('(orientation:landscape) and (max-height:600px)').matches;
  }

  function section(){
    var title=document.getElementById('documentTitle');
    var value=title?String(title.value||title.textContent||''):'';
    var match=value.match(/Secci[oó]n\s*([123])/i);
    if(match)return Number(match[1]);
    var status=document.getElementById('pageStatus');
    var text=status?String(status.textContent||''):'';
    match=text.match(/P[aá]gina\s*([123])\s*de\s*3/i);
    return match?Number(match[1]):0;
  }

  function isGeneralInstruction(text,current){
    text=String(text||'').toLowerCase();
    if(current===2)return /haz clic dentro de cada celda/.test(text);
    if(current===3)return /aqu[ií].*insertar[aá]s la captura de pantalla/.test(text);
    return false;
  }

  function removeCustomInstruction(){
    var custom=document.getElementById('samuelV3LandscapeInstruction');
    if(custom)custom.remove();
  }

  function reconcile(){
    pending=false;
    var current=section();

    if(current!==previousSection){
      if(current===2||current===3)dismissed[current]=false;
      previousSection=current;
    }

    document.querySelectorAll('.samuel-tutorial-tip').forEach(function(tip){
      tip.classList.toggle(
        'v3-duplicate-main-instruction',
        landscape()&&(current===2||current===3)&&isGeneralInstruction(tip.textContent,current)
      );
    });

    if(!landscape()||current<2||current>3||dismissed[current]){
      removeCustomInstruction();
    }
  }

  function schedule(){
    if(pending)return;
    pending=true;
    window.requestAnimationFrame(reconcile);
  }

  document.addEventListener('pointerdown',function(event){
    if(!landscape())return;
    var current=section();
    var clickedWorkArea=false;

    if(current===2){
      clickedWorkArea=!!(event.target.closest&&event.target.closest('#editor2 .weekly-budget-table'));
    }else if(current===3){
      clickedWorkArea=!!(event.target.closest&&event.target.closest('#page3'));
    }

    if(clickedWorkArea){
      dismissed[current]=true;
      removeCustomInstruction();
      document.querySelectorAll('.samuel-tutorial-tip').forEach(function(tip){
        if(isGeneralInstruction(tip.textContent,current))tip.classList.add('v3-duplicate-main-instruction');
      });
    }
  },true);

  function init(){
    schedule();
    var observer=new MutationObserver(function(records){
      var relevant=records.some(function(record){return record.addedNodes&&record.addedNodes.length;});
      if(relevant)schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',function(){window.setTimeout(schedule,180)},{passive:true});
  document.addEventListener('click',function(){window.setTimeout(schedule,40)},true);
})();


;/* ===== samuel-v3-landscape-backstage-compact-js ===== */

(function(){
  'use strict';
  if(window.__samuelV3LandscapeBackstageCompact)return;
  window.__samuelV3LandscapeBackstageCompact=true;

  function horizontal(){
    return window.matchMedia('(orientation:landscape) and (max-height:600px)').matches;
  }

  function keepSaveAsReachable(){
    if(!horizontal())return;
    var backstage=document.getElementById('backstage');
    var menu=backstage&&backstage.querySelector('.backstage-menu');
    var saveAs=menu&&menu.querySelector('[data-backstage="saveAs"]');
    if(!backstage||backstage.hidden||!menu||!saveAs)return;

    saveAs.style.setProperty('display','flex','important');
    saveAs.style.setProperty('visibility','visible','important');
    saveAs.style.setProperty('pointer-events','auto','important');
  }

  function refresh(){window.requestAnimationFrame(keepSaveAsReachable);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();

  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('orientationchange',function(){window.setTimeout(refresh,180)},{passive:true});
  document.addEventListener('click',function(event){
    if(event.target.closest('[data-tab="archivo"], #backstage .backstage-menu button'))window.setTimeout(keepSaveAsReachable,30);
  },true);
})();

