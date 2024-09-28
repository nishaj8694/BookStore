const express = require('express');
const mongoose = require('mongoose');
const multer=require('multer')
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt=require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const { type } = require('os');
const app = express();
const Port = 5000;


app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,  // allow cookies to be sent with requests
}));



mongoose.connect('mongodb://localhost:27017/BookStore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}) 
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));




const Schema = mongoose.Schema;

const userSchema = new Schema({
  book: String,
  author: String,
  page: Number,
  price: Number,
  journal: String,  
  image:String
});
const registerSchema = new Schema({
  name: String,
  email: String,
  number: Number,
  password: String,
});

  // orderId: {type:Number,unique:true,index:true},

const orderSchema = new Schema({
  productId: String,
  price: Number,
  count: Number,
  orderDate:{type:Date,default:Date.now()},
  orderStatus:{type:String,default:'Pending'}
});



const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname) 
  }
});

const upload = multer({ storage: storage });

const BookItem = mongoose.model("book", userSchema);
const Users =mongoose.model('user',registerSchema);
const Order =mongoose.model('order',orderSchema);



app.get("/", (req, res) => {
  res.send('send the flower');
});


const ProtectedRoute = async(req,res,next)=>{
  const token = req.cookies.Token;
  if (!token){
        console.log("no token")
        res.status(404).json({message:'Ooops! token not found,Please login'})
  }
  jwt.verify(token,'secret',(eror,decode)=>{
    if(eror){
        if(eror.name==='TokenExpiredError'){
          console.log("token expaired")
          res.status(404).json({message:'token is expaired'})
        }
    }
    else{
        console.log("token expaired one two ")
        req.user=decode['email'];
        // console.log(decode,decode.exp)
        next(); 
    }
  })
}

app.get("/verifyUser",async(req,res)=>{
  console.log("user hit the verify route")
  const token = await req.cookies.Token;
  if (!token){
        console.log("your are not verify user")
        res.status(401).json({message:'Ooops!,got to the login panal'})
  }
  jwt.verify(token,'secret',(eror,decode)=>{
    if(eror){
        if(eror.name==='TokenExpiredError'){
          console.log("token expaired")
          res.status(401).json({message:'token is expaired'})
        }
    }
    else{
      console.log("user valied")
      res.status(200).json({message:'your are valied user dont be afarid'})    
    
    }
  })

})

app.get("/showbook",ProtectedRoute, async(req,res)=>{
  try{
    const bk= await BookItem.find()
  //   bk.forEach(book => {
      // book.image = book.image.replace(/\\/g, '/');
  // });

    // console.log(bk)
    res.status(200).json({data:bk, message: 'show book success' });
  }
  catch{
    res.status(400).json({message:'no token found access deniaed'})
  }  
})


app.post("/orderbook", async(req,res)=>{
  const {order,address}=req.body
  const result = order.map(async(item) => {
    try {
      const orderitm = new Order({
        productId: item._id,
        price: item.price,
        count: item.count,
      });
      
      const savedOrder = await orderitm.save();
      console.log(savedOrder)
      return { success: true, data: savedOrder }; // Success case for this item
    } catch (err) {
      console.error(`Error saving order for productId ${item._id}:`, err);
      return { success: false, error: err.message }; // Failure case for this item
    }
  
  });
  
  try {
    const success = await Promise.all(result);
    console.log('All orders saved:', success);
    res.status(201).json({message:'order is conformed'})

  } catch (error) {
    console.error('Error saving orders:', error);
    res.status(422).json({message:'order canceled'})

  }
  

})


app.get("/bookdisplay", async(req,res)=>{
  try{
    const{price,page}=req.query
    const query = {};
    if (price) {
      query.price = { $lt: price };
    }
    if (page) {
        query.page = { $lt: page }; 
    }
    const bk= await BookItem.find(query).limit(6)
    res.status(200).json({data:bk, message: 'show book success' });
  }
  catch{
    res.status(400).json({message:'no token found access deniaed'})
  }  
})

app.get("/logout", async(req,res)=>{
  if(req.cookies.Token){
    res.clearCookie("Token"); 
    res.status(200).json({ message: 'Logout success' });
  }
  else{
    res.status(300).json({message:'oops something went wrong'})
  }
})


app.post("/login", async(req,res)=>{
    console.log('server hit success')
  try{
      const {email,password}=req.body;
      const person = await Users.findOne({email:email});
      if(!person){
          console.log('no such person') 
          res.status(300).json({message:'No such user available'})
      }
      const isMatch = await bcrypt.compare(password,person.password);
      if(!isMatch){
        res.status(404).json({message:'Password is incurrect'})
      }
      const token = jwt.sign({name:person.name,email:person.email},'secret',{ expiresIn: '1h' })
      res.cookie('Token', token, {httpOnly:true, sameSite:'lax', secure:false, path:'/', maxAge:36000000})
      res.status(200).json({message:'login success'}); 
  }
  catch{

  }
})

app.post("/Register",upload.none(), async(req,res)=>{
  try{
    const { name,email,number,password }=req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const usercreate = new Users({name,email,number,password:hashedPassword}); 
    const usersave=await usercreate.save();
    res.status(201).json({message: 'User created successfully'});
  }
  catch(err){
    res.status(400).send(err)
  }
})


app.post("/createBook",upload.single('image'), async (req, res) => {  
  try {
    const storeBook = new BookItem({
      book: req.body.book,
      author: req.body.author, 
      page: req.body.page,
      price: req.body.price,
      journal: req.body.journal,
      image:req.file.path  
    });
    const booksave = await storeBook.save(); 
    res.status(200).json({ message: 'Book saved successfully', data: booksave });
  } catch (err) {
    res.status(500).json({ message: 'Error saving the book', error: err.message });
  }
});

app.listen(Port, () => {
  console.log(`Server running on http://localhost:${Port}`);
});
