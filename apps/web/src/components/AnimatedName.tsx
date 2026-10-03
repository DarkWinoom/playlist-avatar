import { AnimatePresence,motion } from 'motion/react';
export function AnimatedName({value,reduce}:{value:string;reduce:boolean}){
  return <span className="animated-name" aria-label={value}><span className="visually-hidden">{value}</span><AnimatePresence initial={false} mode="popLayout"><motion.span key={value} aria-hidden="true" initial={{y:reduce?0:14,opacity:0}} animate={{y:0,opacity:1}} exit={{y:reduce?0:-14,opacity:0}} transition={{duration:reduce?.01:.17}}>{value}</motion.span></AnimatePresence></span>;
}
