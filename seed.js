const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://adsckqobdvciomkwngeo.supabase.co',
  'sb_publishable_XzFa7J_lfGeCfFed6GMdQA_LutVrn6m'
);

async function seedData() {
  console.log("Signing up dummy user to bypass RLS...");
  const email = `demo.seeder1@gmail.com`;
  const password = "password123456";
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "Demo Reporter"
      }
    }
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    return;
  }
  
  console.log("User signed up:", authData.user?.id);
  
  // Create a new client with the user's access token
  const authenticatedSupabase = createClient(
    'https://adsckqobdvciomkwngeo.supabase.co',
    'sb_publishable_XzFa7J_lfGeCfFed6GMdQA_LutVrn6m',
    {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session?.access_token}`
        }
      }
    }
  );

  console.log("Seeding reports...");
  const dummyReports = [
    {
      reporter_id: authData.user?.id,
      damage_type: 'pothole',
      severity: 'high',
      confidence: 0.92,
      description: 'Deep pothole on the right lane, very dangerous for motorcycles.',
      latitude: 8.9475 + (Math.random() * 0.02 - 0.01),
      longitude: 125.5406 + (Math.random() * 0.02 - 0.01),
      address: 'J.C. Aquino Ave, Butuan City',
      status: 'reported',
      image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&q=80'
    },
    {
      reporter_id: authData.user?.id,
      damage_type: 'longitudinal_crack',
      severity: 'medium',
      confidence: 0.85,
      description: 'Long crack stretching for about 5 meters.',
      latitude: 8.9475 + (Math.random() * 0.02 - 0.01),
      longitude: 125.5406 + (Math.random() * 0.02 - 0.01),
      address: 'Montilla Blvd, Butuan City',
      status: 'verified',
      image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&q=80'
    },
    {
      reporter_id: authData.user?.id,
      damage_type: 'pothole',
      severity: 'critical',
      confidence: 0.98,
      description: 'Massive crater causing traffic slowdowns.',
      latitude: 8.9475 + (Math.random() * 0.02 - 0.01),
      longitude: 125.5406 + (Math.random() * 0.02 - 0.01),
      address: 'Ampayon Highway, Butuan',
      status: 'in_progress',
      image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&q=80'
    },
    {
      reporter_id: authData.user?.id,
      damage_type: 'faded_markings',
      severity: 'low',
      confidence: 0.75,
      description: 'Pedestrian lane is barely visible.',
      latitude: 8.9475 + (Math.random() * 0.02 - 0.01),
      longitude: 125.5406 + (Math.random() * 0.02 - 0.01),
      address: 'Near Urios University',
      status: 'reported',
      image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&q=80'
    },
    {
      reporter_id: authData.user?.id,
      damage_type: 'rutting',
      severity: 'medium',
      confidence: 0.88,
      description: 'Uneven asphalt causing vehicles to swerve.',
      latitude: 8.9475 + (Math.random() * 0.02 - 0.01),
      longitude: 125.5406 + (Math.random() * 0.02 - 0.01),
      address: 'Bancasi Airport Road',
      status: 'scheduled',
      image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&q=80'
    }
  ];

  const { data, error } = await authenticatedSupabase.from('reports').insert(dummyReports).select();
  if (error) {
    console.error("Seed Error:", error.message, error.details);
  } else {
    console.log(`Successfully seeded ${data.length} reports!`);
  }
}

seedData();
