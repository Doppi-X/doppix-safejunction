# Do'ppiX SafeJunction — 7 daqiqalik nutq

Rejim: **Startup**. Tavsiya etilgan taqsimot: muammo 1 min, demo 2 min, texnologiya 2 min, budjet 1.5 min, keyingi qadamlar 0.5 min.
Kim gapiradi (o'zgartirsangiz bo'ladi): **Eldor**: 1, 2, 5, 6, 7 · **Shohruh**: 3, 4 (jonli demo) · **Soibnazar**: 8, 9, 10.

> Jonli demo uchun oldindan: saytni telefon/noutbukda ochib qo'ying. 40 soniyalik video tayyor tursin. Internet uzilsa, zaxira video bor (`docs/demo_backup.mp4`).

---

### 1-slayd · 0:00–0:20 · Eldor
"Biz Do'ppiX jamoasimiz. Rejimimiz: **Startup**. SafeJunction shahardagi istalgan yo'l kamerasini yo'l xavfsizligi auditoriga aylantiradi."

### 2-slayd · 0:20–1:05 · Eldor
"Bugun shahar qaysi chorraha xavfli ekanini **avariyadan keyin** biladi. Biz bitta Toshkent chorrahasining 18 daqiqalik videosini o'zimiz labelladik:
- piyodalar zebradan tashqarida soatiga 52 marta yuradi;
- mashinalar soatiga 29 marta piyodaga yo'l bermaydi;
- qizilda o'tish soatiga 7 marta.

Hech kim jarohatlanmagan, shuning uchun bularning birortasi statistikaga tushmaydi. Foydalanuvchimiz: tuman yo'l harakati muhandisi. Pul to'lovchi: shahar yo'l xavfsizligi budjeti, kamera boshiga oylik obuna."

### 3-slayd · 1:05–1:35 · Shohruh
"Bitta kameradan butun shahar reytingigacha:
- videoni yuklaysiz, xohlasangiz zebra va stop-chiziqni chizasiz;
- muhandis hisobot, xavf xaritasi va PDF oladi;
- har bir kamera shahar dashboard'iga tushadi va xavf bo'yicha tartiblanadi. Muhandis qaysi chorrahani birinchi tuzatishni ko'radi.

O'zgarishdan oldin va keyin yuklab, natijani foizda solishtirish mumkin. Zona chizilmasa ham ishlaydi: yo'l va harakat yo'nalishini transportning o'zidan o'rganadi."

### 4-slayd · 1:35–3:05 · Shohruh · JONLI DEMO
1. QR kodni ko'rsating: "Telefoningizda sinab ko'ring."
2. Saytda **Choose file** → 40 soniyalik video. Progress chiqadi.
3. Ishlanayotganda zebra va stop-chiziqni chizing (10 soniya).
4. Natija:
   - **Safety report**: hodisalar soni;
   - **Learned lane directions** tugmasi: ko'k strelkalar, "tizim buni o'zi o'rgandi";
   - videoda yuzlar va raqamlar xiralashtirilgan;
   - **Hotspot map**: hodisalar aynan qayerda bo'lgani;
   - **PDF report** tugmasi: muhandis uchun hisobot.
5. **City dashboard**: yuklangan kamera reytingda paydo bo'ldi.
6. Hakam video bersa, shu yerda uni yuklang.

Vaqt yetmasa: **Results** bo'limida tayyor misol ("Best example of → Red-light running").

### 5-slayd · 3:05–4:05 · Eldor
"Bu birovning modeliga bitta so'rov emas, to'liq tizim:
- o'zimiz o'qitgan YOLO26m va kuzatuv (tracking);
- sahna: chizilgan zonalar, tanilgan kamera yoki transportdan o'rganilgan yo'nalishlar;
- 10 ta tushunarli qoida va **PET**: xalqaro yo'l xavfsizligi tadqiqotlarida ishlatiladigan o'lchov. Bitta yo'l harakati ishtirokchisi biror nuqtani tark etgandan keyin ikkinchisi u yerga necha soniyada keladi; 1.5 soniyadan kam bo'lsa, jiddiy holat;
- yuz va raqamlarni xiralashtirish;
- hisobot.

Hammasi shahar serverida, bitta RTX 3060'da ishlaydi va real vaqtdan 2 barobar tez. Bitta GPU 4 ta kamerani ko'taradi. Kamera boshiga infratuzilma narxi oyiga ~13 dollar."

### 6-slayd · 4:05–4:45 · Eldor
"Nima uchun buni bir dam olish kunida nusxalab bo'lmaydi?
1. **Data:** o'zimiz labellagan 12,990 ta box: Toshkent mashinalari, bizning svetoforlar. Buning uchun o'z labellash dasturimizni yozdik.
2. **Pipeline:** yo'nalishlarni transportdan o'rganish. Mashina o'z izi chiqarib tashlangan holda tekshiriladi, shuning uchun bitta teskari yurgan mashina tizimni adashtira olmaydi.
3. **Sohaning standart usullari:** PET, 1000 piyodaga nisbat va AQSh Highway Safety Manual'dagi Empirical Bayes reytingi. Miovision va Transoft aynan shu narsalarni sotadi, lekin bitta chorrahani bir marta tekshirish ~8 ming dollar turadi. Biz mavjud kamerada doimiy ishlaymiz."

### 7-slayd · 4:45–5:25 · Eldor
"Raqamlar halol:
- teskari harakat: 18 daqiqa real trafikda **0 ta yolg'on signal**, sun'iy teskari yurgizilgan 60 mashinaning **93%** i topildi;
- zaif tomonimiz **tun** edi: aniqlik 0.39. Kadrni yorqinlashtirish yordam bermadi, yomonlashtirdi.
- Finalda sun'iy tun bilan qayta o'qitdik: sun'iy testda 0.39 dan 0.92 ga chiqdi. Lekin biz bunga ishonmadik: 3 ta hech ko'rilmagan kameradan 35 ta **haqiqiy tungi** kadrni labelladik. U yerda bu model atigi **0.06** ko'rsatdi, ya'ni sun'iy tun haqiqiy tunni o'rgatmaydi. Haqiqiy tunda eng yaxshisi umumiy model: **0.58**.
- Lekin bu model kunduzgi hodisa bahosini 0.83 dan 0.77 ga tushirdi. Shuning uchun har bir kamera ulanganda tizim 6 ta kadrda uchta modelni sinaydi: bizning kunduzgi, bizning tungi va umumiy COCO modeli. Qaysi biri ishonchliroq ko'rsa, o'sha tanlanadi.
- Boshqa shaharlardan 9 ta kamera bilan sinadik: tungi dron ko'rinishida 6 ta kadrda bizning model 7 ta, umumiy model 211 ta ishonchli obyekt ko'rdi, shuning uchun umumiy model tanlandi.
- Ochiq aytamiz: bu sun'iy tungi test. Haqiqiy tungi video pilotning birinchi oyida yig'iladi."

### 8-slayd · 5:25–6:20 · Soibnazar
"3 oylik pilot 12,400 dollar turadi: 8 kamera, 3 chorraha. Bunga 3 kishilik jamoa, 2 ta server va labellash kiradi. Obuna kamera boshiga oyiga 40 dollar, infratuzilma 12.7 dollar, ya'ni marja 68%. 110 kamerada o'zini qoplaydi. 300 kamerada pilot 2.4 oyda qaytadi. Barcha farazlar saytdagi kalkulyatorda, o'zingiz o'zgartirib ko'rishingiz mumkin."

### 9-slayd · 6:20–6:50 · Soibnazar
"Pilot uch oyda, mavjud qoidalar doirasida:
- 1-oy: kameralarni ulash va tungi video yig'ish;
- 2-oy: qayta o'qitish;
- 3-oy: bitta o'zgarishni, masalan piyodaga oldinroq yashil berishni, oldin va keyin o'lchash.

Video shahar serveridan chiqmaydi, yuz va raqamlar xiralashtiriladi, faqat hodisa metadatasi saqlanadi."

### 10-slayd · 6:50–7:00 · Soibnazar
"Final oldidan qilingan ish (elimination) va finalda qilingan ish README'da va git tarixida alohida ko'rsatilgan. Rahmat!"

---

## Kutilayotgan savollar va qisqa javoblar
- **"LLM bilan yozilganmi?"** — "Ha, AI assistent bilan yozdik, bu README'da yozilgan. Lekin arxitektura, data va qoidalar bizniki. Har bir qismni tushuntira olamiz." *(Kodni oching: `core/doppix/generic.py`, `autoscene.py`.)*
- **"Tunda ishlaydimi?"** — "Haqiqiy tunda labellangan testimiz bor: 3 ta notanish kamera, 35 kadr. Eng yaxshi model 0.58. Tizim tunda o'sha modelni o'zi tanlaydi. Sun'iy tunda 0.92 chiqqan edi, haqiqiy tunda 0.06 bo'ldi. Shuning uchun haqiqiy data yig'ish pilotning 1-oyida."
- **"Boshqa kamerada ishlaydimi?"** — "Ha. Nyu-York, Tokio, Tehron, Koreya, Ottava, dron, tun, yomg'ir: 9 ta ochiq litsenziyali video dashboard'da turibdi. Ochiq aytamiz: qisqa videoda zona chizilmasa, kam hodisa topiladi; kunduzgi dron ko'rinishida hali ikkala model ham zaif. Shuning uchun zona chizish 2 daqiqa va pilotda shu kameralarda qayta o'qitish bor."
- **"Deploy tarixi?"** — GitHub → Actions bo'limi (har bir push = deploy). Server: `deploy/serve.py`.
- **"Shaxsiy ma'lumotlar?"** — Yuzlar va raqamlar serverda xiralashtiriladi, videolar 6 soatdan keyin o'chiriladi, faqat metadata saqlanadi.
- **"Nega qoidalar, nega neural tarmoq emas?"** — "Har bir hodisa turi uchun bir necha misol bor, neural tarmoq o'rganishi uchun yetmaydi. Qoidani esa videoga qarab tekshirsa bo'ladi, muhandis unga ishonadi."
