import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  author: string;
  company: string;
}

interface TestimonialsProps {
  title: string;
  subtitle: string;
  items: Testimonial[];
}

export const Testimonials = ({ title, subtitle, items }: TestimonialsProps) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="container mx-auto px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            {title}
          </h2>
          <p className="text-xl text-muted-foreground font-light">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {items.map((testimonial, index) => (
            <Card 
              key={index} 
              className="border-2 hover:border-primary/20 transition-colors bg-muted/20"
            >
              <CardContent className="p-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Quote className="w-6 h-6 text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <blockquote className="text-muted-foreground leading-relaxed mb-4">
                      "{testimonial.quote}"
                    </blockquote>
                    
                    <div className="border-t pt-4">
                      <div className="font-semibold text-foreground">
                        {testimonial.author}
                      </div>
                      {testimonial.company && (
                        <div className="text-sm text-muted-foreground">
                          {testimonial.company}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
