// src/components/NeuralNetwork.tsx

import { useEffect, useRef } from 'react';
import type p5 from 'p5';

const NeuralNetwork = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        let p5Instance: p5 | null = null;

        const initializeSketch = async () => {
            const p5 = (await import('p5')).default;

            const sketch = (p: p5) => {
                class Particle {
                    pos: p5.Vector;
                    vel: p5.Vector;
                    acc: p5.Vector;
                    maxSpeed = 1;
                    isAccent: boolean;
    
                    constructor() {
                        this.pos = p.createVector(p.random(p.width), p.random(p.height));
                        this.vel = p5.Vector.random2D();
                        this.vel.setMag(p.random(0.5, 1.5));
                        this.acc = p.createVector(0, 0);
                        this.isAccent = p.random(1) < 0.1;
                    }
    
                    update() {
                        this.vel.add(this.acc);
                        this.vel.limit(this.maxSpeed);
                        this.pos.add(this.vel);
                        this.acc.mult(0);
                        this.edges();
                    }
    
                    edges() {
                        if (this.pos.x > p.width) this.pos.x = 0;
                        if (this.pos.x < 0) this.pos.x = p.width;
                        if (this.pos.y > p.height) this.pos.y = 0;
                        if (this.pos.y < 0) this.pos.y = p.height;
                    }
    
                    show() {
                        p.noStroke();
                        if (this.isAccent) {
                            p.fill('rgba(251, 191, 38, 0.7)');
                        } else {
                            p.fill('rgba(34, 211, 238, 0.5)');
                        }
                        p.circle(this.pos.x, this.pos.y, 4);
                    }
                }

                let particles: Particle[] = [];
                const isMobile = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
                const numParticles = isMobile ? 25 : 50;
                const connectDistance = isMobile ? 90 : 120;

                p.setup = () => {
                    if (containerRef.current) {
                        p.createCanvas(containerRef.current.offsetWidth, containerRef.current.offsetHeight).parent(containerRef.current);
                        for (let i = 0; i < numParticles; i++) {
                            particles.push(new Particle());
                        }
                        if (isMobile) {
                            p.frameRate(30);
                        }
                    }
                };

                p.draw = () => {
                    p.background('#030b17');
                    particles.forEach((particle) => {
                        particle.update();
                        particle.show();
                    });
                    for (let i = 0; i < particles.length; i++) {
                        for (let j = i + 1; j < particles.length; j++) {
                            const d = p.dist(
                                particles[i].pos.x, particles[i].pos.y,
                                particles[j].pos.x, particles[j].pos.y
                            );
                            if (d < connectDistance) {
                                const alpha = p.map(d, 0, connectDistance, 0.3, 0);
                                p.stroke(`rgba(55, 65, 81, ${alpha})`);
                                p.line(
                                    particles[i].pos.x, particles[i].pos.y,
                                    particles[j].pos.x, particles[j].pos.y
                                );
                            }
                        }
                    }
                };

                p.windowResized = () => {
                    if (containerRef.current) {
                        p.resizeCanvas(containerRef.current.offsetWidth, containerRef.current.offsetHeight);
                    }
                };
            };

            if (containerRef.current) {
                p5Instance = new p5(sketch, containerRef.current);

                observerRef.current = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                p5Instance?.loop();
                            } else {
                                p5Instance?.noLoop();
                            }
                        });
                    },
                    { threshold: 0.01 }
                );
                observerRef.current.observe(containerRef.current);
            }
        };

        initializeSketch();

        return () => {
            observerRef.current?.disconnect();
            p5Instance?.remove();
        };
    }, []);

    return <div ref={containerRef} className="w-full h-full" />;
};

export default NeuralNetwork;
