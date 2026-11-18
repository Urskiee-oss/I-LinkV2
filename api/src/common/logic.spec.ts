import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeFloodTier } from '../flood/flood.module';
import { scoreCommunityReport, scoreEmergencyReport } from './report-helpers';
import { primaryRoleOf } from './types';

describe('I-Link Community Intelligence & Flood Logic', () => {
  it('resolves primaryRole hierarchy (admin > responder > resident)', () => {
    assert.equal(primaryRoleOf(['resident']), 'resident');
    assert.equal(primaryRoleOf(['resident', 'responder']), 'responder');
    assert.equal(primaryRoleOf(['resident', 'responder', 'admin']), 'admin');
  });

  it('scores life-safety emergency reports with vulnerability keywords as critical', () => {
    const res = scoreEmergencyReport({
      category: 'flood',
      title: 'Rising floodwater near elementary school',
      description: 'Elderly residents trapped on ground floor as water rises quickly.',
      locationText: 'Purok 3 near school',
      peopleAffected: 6,
    });
    assert.equal(res.priority, 'critical');
    assert.ok(res.score >= 90);
    assert.ok(res.reasons.length > 2);
  });

  it('boosts recurring community cleanliness reports when category cluster is detected', () => {
    const single = scoreCommunityReport({
      category: 'blocked_drainage',
      title: 'Clogged canal inlet',
      description: 'Drainage is blocked by plastic bottles along Purok 3.',
      locationText: 'Purok 3',
      nearbyRecentCount: 0,
    });
    const hotspot = scoreCommunityReport({
      category: 'blocked_drainage',
      title: 'Clogged canal inlet',
      description: 'Drainage is blocked by plastic bottles along Purok 3.',
      locationText: 'Purok 3',
      nearbyRecentCount: 3,
    });
    assert.ok(hotspot.score > single.score);
  });

  it('computes PAGASA/NDRRMC 4-tier flood alerts and escalates on rapid rise velocity', () => {
    const thresholds = {
      advisoryCm: 50,
      warningCm: 100,
      dangerCm: 150,
      criticalCm: 200,
      rapidRiseCmMin: 2,
    };

    assert.equal(computeFloodTier({ depthCm: 20, riseCmMin: 0.2, ...thresholds }), 'normal');
    assert.equal(computeFloodTier({ depthCm: 60, riseCmMin: 0.5, ...thresholds }), 'advisory');
    // Rapid rise velocity >= 2.0 cm/min escalates advisory -> warning
    assert.equal(computeFloodTier({ depthCm: 60, riseCmMin: 2.5, ...thresholds }), 'warning');
    assert.equal(computeFloodTier({ depthCm: 155, riseCmMin: 0.4, ...thresholds }), 'danger');
    assert.equal(computeFloodTier({ depthCm: 210, riseCmMin: 3.0, ...thresholds }), 'critical');
  });
});
