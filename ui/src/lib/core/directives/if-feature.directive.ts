import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { EntitlementsService } from '../services/entitlements.service';
import type { FeatureKey } from '@shared';

@Directive({ selector: '[libIfFeature]', standalone: true })
export class IfFeatureDirective {
  private ent = inject(EntitlementsService);
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);

  private feature?: FeatureKey;
  private rendered = false;

  @Input({ required: true }) set libIfFeature(feature: FeatureKey) {
    this.feature = feature;
  }

  constructor() {
    effect(() => {
      const show = this.feature ? this.ent.has(this.feature) : false;
      if (show && !this.rendered) {
        this.vcr.createEmbeddedView(this.tpl);
        this.rendered = true;
      } else if (!show && this.rendered) {
        this.vcr.clear();
        this.rendered = false;
      }
    });
  }
}
