// // POST /api/admin/notices
// import { NextApiRequest, NextApiResponse } from 'next';
// import Notice from '@/models/Notice';

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method === 'POST') {
//     const { title, message, employeeIds } = req.body;
//     try {
//       const notice = await Notice.create({ title, message, employeeIds });
//       res.status(201).json({ success: true, notice });
//     } catch (err) {
//       res.status(500).json({ error: 'Server error' });
//     }
//   } else {
//     res.status(405).json({ error: 'Method not allowed' });
//   }
// }
