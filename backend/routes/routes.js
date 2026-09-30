const express = require('express');
const router = express.Router();
const pool = require('../db');


// ดูเส้นทาง
router.get('/', async (req,res)=>{
    try{
        const result = await pool.query(
            'SELECT * FROM routes WHERE is_active = true ORDER BY origin'
        );

        res.json(result.rows);

    }catch(err){
        console.error(err);
        res.status(500).json({message:'เกิดข้อผิดพลาด'});
    }
});


// เพิ่มเส้นทาง
router.post('/', async(req,res)=>{

    try{

        const {
            origin,
            destination,
            estimated_hours,
            price
        } = req.body;


        const result = await pool.query(
            `
            INSERT INTO routes
            (origin,destination,estimated_hours,price,is_active)
            VALUES($1,$2,$3,$4,true)
            RETURNING *
            `,
            [
                origin,
                destination,
                estimated_hours,
                price
            ]
        );


        res.json({
            message:"เพิ่มเส้นทางสำเร็จ",
            data:result.rows[0]
        });


    }catch(err){

        console.error(err);

        res.status(500).json({
            message:"เพิ่มข้อมูลไม่สำเร็จ"
        });

    }

});


module.exports = router;