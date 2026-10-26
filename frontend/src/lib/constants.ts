export interface BDMUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: string;
  phone: string;
}

export const DEFAULT_BDMS: BDMUser[] = [
  { name: 'Thirunavukarasu', email: 'thirunavukarasu@alpha.com', role: 'BDM', phone: '+91 98401 10001' },
  { name: 'Gopinath', email: 'gopinath@alpha.com', role: 'BDM', phone: '+91 98401 10002' },
  { name: 'Javith', email: 'javith@alpha.com', role: 'BDM', phone: '+91 98401 10003' },
  { name: 'Mohamed Ashik', email: 'mohamedashik@alpha.com', role: 'BDM', phone: '+91 98401 10004' },
  { name: 'Dhananjay', email: 'dhananjay@alpha.com', role: 'BDM', phone: '+91 98401 10005' },
  { name: 'Balaji', email: 'balaji@alpha.com', role: 'BDM', phone: '+91 98401 10006' },
  { name: 'Aravind', email: 'aravind@alpha.com', role: 'BDM', phone: '+91 98401 10007' },
  { name: 'Naveen', email: 'naveen@alpha.com', role: 'BDM', phone: '+91 98401 10008' },
  { name: 'Eswar', email: 'eswar@alpha.com', role: 'BDM', phone: '+91 98401 10009' },
  { name: 'Nitesh', email: 'nitesh@alpha.com', role: 'BDM', phone: '+91 98401 10010' },
];
