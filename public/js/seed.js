// Datos iniciales de demostración (solo se carga si la BD está vacía)
function seed() {
  if (DB.get('props').length > 0) return;
  DB.set('props', [
    { id: 'p1', tdoc: 'CC', cedula: '1018436172', nombre: 'Iván Durán', telefono: '+573103314665', email: 'ivanduranmonroy@hotmail.com', direccion: 'Cra 9 # 14-99', ciudad: 'Barbosa', como: 'redes', contacto: 'Ivan', talt: '', created: '16/04/2026' },
    { id: 'p2', tdoc: 'CC', cedula: '1099214759', nombre: 'Daniela Florez', telefono: '+573219589419', email: 'danielaflorez96@gmail.com', direccion: 'Barbosa', ciudad: 'Barbosa', como: 'recom', contacto: '', talt: '', created: '09/04/2026' },
    { id: 'p3', tdoc: 'CC', cedula: '7307038', nombre: 'José Maria Pinilla López', telefono: '+573214512445', email: 'josepinilla145@yahoo.es', direccion: 'Barbosa', ciudad: 'Barbosa', como: 'google', contacto: '', talt: '', created: '31/03/2026' },
    { id: 'p4', tdoc: 'CC', cedula: '32800726', nombre: 'Dina Morales', telefono: '+573124343146', email: 'milcositasshopping@gmail.com', direccion: 'Barbosa', ciudad: 'Barbosa', como: '', contacto: '', talt: '', created: '14/04/2026' },
    { id: 'p5', tdoc: 'CC', cedula: '23497435', nombre: 'Betariz González G', telefono: '+573112126969', email: 'copiatex9928@gmail.com', direccion: 'Barbosa', ciudad: 'Barbosa', como: 'redes', contacto: '', talt: '', created: '13/04/2026' },
  ]);
  DB.set('mas', [
    { id: 'm1', pid: 'p1', nombre: 'Queen', chip: '', esp: 'canino', raza: 'Dobermann', gen: 'hembra', color: 'negro', fn: '2023-07-07', peso: 28, talla: 'grande', repr: 'no_esterilizado', ali: 'NutreCan Croquetas', serv: false, emoc: false, created: '16/04/2026' },
    { id: 'm2', pid: 'p2', nombre: 'Poli', chip: '', esp: 'canino', raza: 'Mestizo', gen: 'hembra', color: 'café', fn: '2022-03-28', peso: 12, talla: 'mediano', repr: 'esterilizado', ali: '', serv: false, emoc: false, created: '28/03/2026' },
    { id: 'm3', pid: 'p3', nombre: 'Alaska', chip: '', esp: 'canino', raza: 'Husky Siberiano', gen: 'hembra', color: 'blanco gris', fn: '2021-06-15', peso: 22, talla: 'mediano', repr: 'esterilizado', ali: '', serv: false, emoc: false, created: '30/03/2026' },
    { id: 'm4', pid: 'p4', nombre: 'Paris Cala', chip: '', esp: 'felino', raza: 'Doméstico', gen: 'hembra', color: 'naranja', fn: '2022-01-10', peso: 4, talla: 'mediano', repr: 'no_esterilizado', ali: '', serv: false, emoc: false, created: '14/04/2026' },
    { id: 'm5', pid: 'p4', nombre: 'Saturno', chip: '', esp: 'felino', raza: 'Criollo(a)', gen: 'macho', color: 'negro', fn: '2020-12-01', peso: 5, talla: 'mediano', repr: 'esterilizado', ali: 'Felix', serv: false, emoc: false, created: '14/04/2026' },
    { id: 'm6', pid: 'p5', nombre: 'Luna', chip: '28032026435', esp: 'canino', raza: 'Labrador', gen: 'hembra', color: 'amarillo', fn: '2021-08-14', peso: 26, talla: 'grande', repr: 'esterilizado', ali: 'Dieta mixta', serv: false, emoc: false, created: '13/04/2026' },
    { id: 'm7', pid: 'p2', nombre: 'Maylon', chip: '16042026024', esp: 'canino', raza: 'Bulldog francés', gen: 'macho', color: 'rojo', fn: '2026-02-10', peso: 2.7, talla: 'pequeño', repr: 'no_esterilizado', ali: 'Dieta Mixta', serv: false, emoc: false, created: '16/04/2026' },
  ]);
  DB.set('segs', [
    { id: 's1', mid: 'm2', tipo: 'hospitalizacion', diag: 'Parvovirus canino grado II', trat: 'Fluidoterapia IV, antieméticos, antibiótico', dia: 3, activo: true, not: 'Mejorando, apetito parcial', fecha: '14/04/2026' },
    { id: 's2', mid: 'm3', tipo: 'ambulatorio', diag: 'Dermatitis atópica', trat: 'Apoquel 5mg/día, champú medicado', dia: 7, activo: true, not: 'Controlando bien', fecha: '10/04/2026' },
    { id: 's3', mid: 'm5', tipo: 'hospitalizacion', diag: 'Post-op orquiectomía', trat: 'Meloxicam 0.5mg/kg, antibiótico profiláctico', dia: 1, activo: true, not: 'Recuperando', fecha: '16/04/2026' },
  ]);
  DB.set('hist', [
    { id: 'h1', mid: 'm4', tipo: 'laboratorio', fecha: '14/04/2026 15:02', desc: 'Hemograma completo', diag: 'Anemia leve', trat: 'Suplemento hierro', med: '', vet: 'Dr. Iván Durán MV', not: '', prox: '', files: [] },
    { id: 'h2', mid: 'm3', tipo: 'formula', fecha: '14/04/2026 15:14', desc: 'Dermatitis recurrente', diag: 'Dermatitis atópica', trat: 'Apoquel + champú medicado', med: 'Apoquel 5mg c/24h x 30 días', vet: 'Dr. Iván Durán MV', not: '', prox: '2026-05-14', files: [] },
    { id: 'h3', mid: 'm5', tipo: 'cirugia', fecha: '13/04/2026 14:22', desc: 'Orquiectomía electiva', diag: '', trat: 'Anestesia general TIVA', med: '', vet: 'Dr. Iván Durán MV', not: 'Post-op sin novedad', prox: '2026-04-20', files: [] },
    { id: 'h4', mid: 'm6', tipo: 'cirugia', fecha: '13/04/2026 13:00', desc: 'Cirugía rodilla — ruptura LCA', diag: 'Ruptura LCA', trat: 'TPLO', med: '', vet: 'Dr. Iván Durán MV', not: '', prox: '', files: [] },
    { id: 'h5', mid: 'm2', tipo: 'vacunacion', fecha: '28/03/2026 10:00', desc: 'Vacuna polivalente', diag: '', trat: '', med: 'Nobivac DA2PP', vet: 'Dr. Iván Durán MV', not: 'Próxima en 1 año', prox: '2027-03-28', files: [] },
    { id: 'h6', mid: 'm1', tipo: 'consulta', fecha: '16/04/2026 09:30', desc: 'Control rutinario', diag: 'Paciente sana', trat: '', med: '', vet: 'Dr. Iván Durán MV', not: '', prox: '', files: [] },
    { id: 'h7', mid: 'm7', tipo: 'vacunacion', fecha: '16/04/2026 10:51', desc: 'Vacuna puppy', diag: '', trat: '', med: 'Nobivac® Puppy DP', vet: 'Monica Sanchez', not: '', prox: '2026-05-05', files: [] },
  ]);
  DB.set('procs', [
    { id: 'pr1', nombre: 'Consulta general', cat: 'consulta', precio: 35000 }, { id: 'pr2', nombre: 'Consulta urgencia', cat: 'consulta', precio: 55000 },
    { id: 'pr3', nombre: 'Cirugía esterilización canina hembra', cat: 'cirugia', precio: 280000 }, { id: 'pr4', nombre: 'Cirugía esterilización canina macho', cat: 'cirugia', precio: 180000 },
    { id: 'pr5', nombre: 'Cirugía esterilización felina hembra', cat: 'cirugia', precio: 200000 }, { id: 'pr6', nombre: 'Cirugía esterilización felina macho', cat: 'cirugia', precio: 140000 },
    { id: 'pr7', nombre: 'Vacuna polivalente canina', cat: 'vacunacion', precio: 45000 }, { id: 'pr8', nombre: 'Vacuna rabia', cat: 'vacunacion', precio: 30000 },
    { id: 'pr9', nombre: 'Desparasitación interna', cat: 'consulta', precio: 25000 }, { id: 'pr10', nombre: 'Hemograma completo', cat: 'laboratorio', precio: 55000 },
    { id: 'pr11', nombre: 'Química sanguínea 6 parámetros', cat: 'laboratorio', precio: 85000 }, { id: 'pr12', nombre: 'Perfil básico 1 (8 param)', cat: 'laboratorio', precio: 95000 },
    { id: 'pr13', nombre: 'Perfil prequirúrgico', cat: 'laboratorio', precio: 120000 }, { id: 'pr14', nombre: 'Radiografía simple', cat: 'imagen', precio: 70000 },
    { id: 'pr15', nombre: 'Radiografía estudio completo', cat: 'imagen', precio: 110000 }, { id: 'pr16', nombre: 'Ecografía abdominal', cat: 'imagen', precio: 120000 },
    { id: 'pr17', nombre: 'Hospitalización / día', cat: 'hospitalizacion', precio: 80000 }, { id: 'pr18', nombre: 'Sedación', cat: 'cirugia', precio: 90000 },
    { id: 'pr19', nombre: 'Anestesia general TIVA', cat: 'cirugia', precio: 180000 }, { id: 'pr20', nombre: 'TPLO cirugía de rodilla', cat: 'cirugia', precio: 1800000 },
    { id: 'pr21', nombre: 'Profilaxis dental talla pequeña', cat: 'cirugia', precio: 120000 }, { id: 'pr22', nombre: 'Profilaxis dental talla mediana', cat: 'cirugia', precio: 160000 },
    { id: 'pr23', nombre: 'Profilaxis dental talla grande', cat: 'cirugia', precio: 200000 }, { id: 'pr24', nombre: 'Cirugía masas y tumores', cat: 'cirugia', precio: 350000 },
    { id: 'pr25', nombre: 'Cirugía digestiva', cat: 'cirugia', precio: 400000 }, { id: 'pr26', nombre: 'Cirugía de piel', cat: 'cirugia', precio: 250000 },
    { id: 'pr27', nombre: 'Sutura herida simple', cat: 'cirugia', precio: 60000 }, { id: 'pr28', nombre: 'Peluquería básica', cat: 'peluqueria', precio: 35000 },
    { id: 'pr29', nombre: 'Baño medicado', cat: 'peluqueria', precio: 50000 }, { id: 'pr30', nombre: 'Guardería / día', cat: 'otro', precio: 45000 },
  ]);
}
