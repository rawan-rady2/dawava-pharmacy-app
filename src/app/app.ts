import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // RouterOutlet must be imported in standalone root
  template: `<router-outlet></router-outlet>`,
})
export class App{}